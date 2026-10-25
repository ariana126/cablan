import { randomUUID } from 'node:crypto';

import {
  AuditAction,
  AuditLogRepository,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLoggingModule } from '@audit-logging/infrastructure/audit-logging.module';
import { ApproveBomCommand } from '@boms/application/commands/approve-bom/approve-bom.command';
import { EditBomCommand } from '@boms/application/commands/edit-bom/edit-bom.command';
import { RejectBomCommand } from '@boms/application/commands/reject-bom/reject-bom.command';
import { BomReportRepository } from '@boms/application/service/bom-report.repository';
import { Bom } from '@boms/domain/bom.aggregate';
import { BomAlreadyReviewed } from '@boms/domain/exceptions/bom-already-reviewed.exception';
import { BomRepository } from '@boms/domain/service/bom.repository';
import { BomComponentLine } from '@boms/domain/value/bom-component-line.vo';
import { BomMaterialLine } from '@boms/domain/value/bom-material-line.vo';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
import { TrackingNumber } from '@boms/domain/value/tracking-number.vo';
import { Weight } from '@boms/domain/value/weight.vo';
import { BomsModule } from '@boms/infrastructure/boms.module';
import { Identity, Role } from '@framework/domain';
import {
  ActorContextMiddleware,
  ActorContextModule,
  AuthModule,
  ClockModule,
  DomainEventsModule,
  EmailModule,
  PrismaModule,
  PrismaService,
  PrismaTransactionsModule,
} from '@framework/infrastructure';
import { IdentityModule } from '@identity/infrastructure/identity.module';
import { ConfigModule } from '@nestjs/config';
import { CommandBus, CqrsModule } from '@nestjs/cqrs';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Request, Response } from 'express';

// ADR 0007 for the daily-BOM review: approving or rejecting a daily BOM and
// its `Approved`/`Rejected` audit entry commit or roll back together — the
// same transactional path every other write takes, here driven through the
// real handlers on the `CommandBus`. An edit of a reviewed BOM writes its
// `Edited` entry and then a separate `ReturnedToPending` one in the same
// transaction, and the list must show the latter as the newer of the two
// even though, under the test stack's pinned clock, both share one
// `occurredAt`. A reviewer's edit is noted on approval although the two are
// separate requests — which only works if the pending review changes survive
// a round trip through `bom.pending_review_changes`. Plus one real-Postgres
// check of the report's reviewer filter (`''` = `reviewed_by IS NULL`, a name
// = that reviewer's approvals and rejections), which a unit test can only
// assert as a Prisma `where` shape. Runs against the test stack's Postgres
// (see `make run-integration-tests`); every case uses fresh ids and a unique
// MI code and deletes its own rows; nothing truncates.

type AuditChangeRow = {
  field: string;
  previousValue: string;
  newValue: string;
};

function changeLinesOf(changes: AuditChangeRow[]) {
  return changes.map(({ field, previousValue, newValue }) => ({
    field,
    previousValue,
    newValue,
  }));
}

// Stored in app_user.password_hash for the test actor; never used to log in.
const UNUSABLE_HASH = 'not-a-bcrypt-hash';

const REASON = 'وزن مس خارج از محدوده است';

describe('daily BOM review', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let boms: BomRepository;
  let reports: BomReportRepository;
  let auditLog: AuditLogRepository;
  let commandBus: CommandBus;
  let jwt: JwtService;
  let actorMiddleware: ActorContextMiddleware;
  // Assigned in beforeAll, before any case runs. A Management user: one who
  // may review.
  let actor: { id: string; name: string };
  let createdBomIds: string[] = [];

  // Runs `work` the way a request does: through the real
  // ActorContextMiddleware, carrying a bearer token whose `sub` is `userId`.
  function runAs<T>(userId: string, work: () => Promise<T>): Promise<T> {
    const request = {
      headers: { authorization: `Bearer ${jwt.sign({ sub: userId })}` },
    } as unknown as Request;
    return new Promise<T>((resolve, reject) => {
      actorMiddleware.use(request, {} as Response, () => {
        work().then(resolve, reject);
      });
    });
  }

  // Saved with no actor in context, so registering writes no audit entry and
  // each case sees only the entries its own review wrote.
  async function savedBom(
    miCode: string,
    trackingNumber = `TRK-${randomUUID()}`,
  ): Promise<Bom> {
    const bom = Bom.register(
      Identity.new(),
      miCode,
      'Legrand',
      `Integration product ${randomUUID()}`,
      305,
      OrderNumber.fromString(`ORD-${randomUUID()}`),
      TrackingNumber.fromString(trackingNumber),
      undefined,
      actor.name,
      [
        BomComponentLine.of(Identity.new(), 'Core', [
          BomMaterialLine.of(Identity.new(), 'Copper', Weight.ofGrams(12)),
        ]),
      ],
    );
    createdBomIds.push(bom.id.asString());
    await boms.save(bom);
    return bom;
  }

  function approve(bom: Bom) {
    return runAs(actor.id, () =>
      commandBus.execute(new ApproveBomCommand(bom.id, actor.name)),
    );
  }

  function reject(bom: Bom) {
    return runAs(actor.id, () =>
      commandBus.execute(new RejectBomCommand(bom.id, actor.name, REASON)),
    );
  }

  function editTrackingNumber(
    bom: Bom,
    editorRole: Role,
    trackingNumber: string,
  ) {
    return runAs(actor.id, () =>
      commandBus.execute(
        new EditBomCommand(
          bom.id,
          editorRole,
          undefined,
          TrackingNumber.fromString(trackingNumber),
        ),
      ),
    );
  }

  function bomRow(bom: Bom) {
    return prisma.bom.findUnique({
      where: { id: bom.id.asString() },
      select: {
        approvalStatus: true,
        reviewedBy: true,
        managementNote: true,
        pendingReviewChanges: true,
      },
    });
  }

  function newestFirstEntriesFor(bom: Bom) {
    return auditLog.search({
      page: 1,
      pageSize: 10,
      filters: { recordId: bom.id.asString() },
    });
  }

  function auditEntriesFor(bom: Bom) {
    return prisma.auditLogEntry.findMany({
      where: { recordId: bom.id.asString() },
      include: { changes: { orderBy: { position: 'asc' } } },
    });
  }

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        // The container's environment (.env.test via Compose) is the config.
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        CqrsModule.forRoot(),
        AuthModule,
        ActorContextModule,
        ClockModule,
        EmailModule,
        PrismaModule,
        PrismaTransactionsModule,
        DomainEventsModule,
        IdentityModule,
        BomsModule,
        AuditLoggingModule,
      ],
    }).compile();
    await moduleRef.init();

    prisma = moduleRef.get(PrismaService, { strict: false });
    boms = moduleRef.get(BomRepository, { strict: false });
    reports = moduleRef.get(BomReportRepository, { strict: false });
    auditLog = moduleRef.get(AuditLogRepository, { strict: false });
    commandBus = moduleRef.get(CommandBus, { strict: false });
    jwt = moduleRef.get(JwtService, { strict: false });
    actorMiddleware = moduleRef.get(ActorContextMiddleware, { strict: false });

    const id = randomUUID();
    actor = { id, name: `Integration reviewer ${id}` };
    await prisma.user.create({
      data: {
        id,
        name: actor.name,
        username: `integration-${id}`,
        passwordHash: UNUSABLE_HASH,
        role: Role.Management,
      },
    });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await prisma.auditLogEntry.deleteMany({
      where: { recordId: { in: createdBomIds } },
    });
    await prisma.bom.deleteMany({ where: { id: { in: createdBomIds } } });
    createdBomIds = [];
  });

  afterAll(async () => {
    if (actor) {
      await prisma?.user.deleteMany({ where: { id: actor.id } });
    }
    await moduleRef?.close();
  });

  it('commits the approval and exactly one Approved audit entry carrying the status and reviewer lines', async () => {
    const bom = await savedBom(`MI-${randomUUID()}`);

    await approve(bom);

    expect(await bomRow(bom)).toEqual({
      approvalStatus: 'approved',
      reviewedBy: actor.name,
      managementNote: null,
      pendingReviewChanges: [],
    });
    const entries = await auditEntriesFor(bom);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual(
      expect.objectContaining({
        recordType: 'Bom',
        action: 'Approved',
        actorId: actor.id,
      }),
    );
    expect(changeLinesOf(entries[0].changes)).toEqual([
      {
        field: 'approvalStatus',
        previousValue: 'pending',
        newValue: 'approved',
      },
      { field: 'reviewedBy', previousValue: '', newValue: actor.name },
    ]);
  });

  it('names the approved daily BOM by its tracking number as the entry’s subject', async () => {
    const trackingNumber = `TRK-${randomUUID()}`;
    const bom = await savedBom(`MI-${randomUUID()}`, trackingNumber);

    await approve(bom);

    const { items } = await newestFirstEntriesFor(bom);
    const details = await auditLog.findChangesByEntryId(
      Identity.fromString(items[0].id),
    );
    expect(details?.subject).toEqual({
      field: 'trackingNumber',
      value: trackingNumber,
    });
  });

  it('commits the rejection with its reason as the management note, and one Rejected audit entry carrying the status, reviewer and note lines', async () => {
    const bom = await savedBom(`MI-${randomUUID()}`);

    await reject(bom);

    expect(await bomRow(bom)).toEqual({
      approvalStatus: 'rejected',
      reviewedBy: actor.name,
      managementNote: REASON,
      pendingReviewChanges: [],
    });
    const entries = await auditEntriesFor(bom);
    expect(entries.map((entry) => entry.action)).toEqual(['Rejected']);
    expect(changeLinesOf(entries[0].changes)).toEqual([
      {
        field: 'approvalStatus',
        previousValue: 'pending',
        newValue: 'rejected',
      },
      { field: 'reviewedBy', previousValue: '', newValue: actor.name },
      { field: 'managementNote', previousValue: '', newValue: REASON },
    ]);
  });

  it('notes a reviewer’s edit when the BOM is approved in a later request, then clears the pending review changes', async () => {
    const bom = await savedBom(`MI-${randomUUID()}`);
    const previousTrackingNumber = bom.trackingNumber().asString();
    const newTrackingNumber = `TRK-${randomUUID()}`;
    await editTrackingNumber(bom, Role.Management, newTrackingNumber);

    await approve(bom);

    const note = `شماره ردیابی از ${previousTrackingNumber} به ${newTrackingNumber} تغییر کرد`;
    expect(await bomRow(bom)).toEqual({
      approvalStatus: 'approved',
      reviewedBy: actor.name,
      managementNote: note,
      pendingReviewChanges: [],
    });
    const { items } = await newestFirstEntriesFor(bom);
    expect(items.map((item) => item.action)).toEqual(['Approved', 'Edited']);
    const approved = await auditLog.findChangesByEntryId(
      Identity.fromString(items[0].id),
    );
    expect(approved?.changes).toContainEqual({
      field: 'managementNote',
      previousValue: '',
      newValue: note,
    });
  });

  it('does not note an inspector’s edit when the BOM is approved', async () => {
    const bom = await savedBom(`MI-${randomUUID()}`);
    await editTrackingNumber(bom, Role.QcInspector, `TRK-${randomUUID()}`);

    await approve(bom);

    expect(await bomRow(bom)).toEqual(
      expect.objectContaining({ managementNote: null }),
    );
  });

  it('records an edit of an approved BOM as an Edited entry, then a newer ReturnedToPending entry naming the BOM by its new tracking number', async () => {
    const bom = await savedBom(`MI-${randomUUID()}`);
    await approve(bom);
    const newTrackingNumber = `TRK-${randomUUID()}`;

    await editTrackingNumber(bom, Role.QcInspector, newTrackingNumber);

    expect(await bomRow(bom)).toEqual({
      approvalStatus: 'pending',
      reviewedBy: null,
      managementNote: null,
      pendingReviewChanges: [],
    });
    const { items } = await newestFirstEntriesFor(bom);
    expect(items.map((item) => item.action)).toEqual([
      'ReturnedToPending',
      'Edited',
      'Approved',
    ]);
    const [returned, edited] = await Promise.all(
      items
        .slice(0, 2)
        .map((item) =>
          auditLog.findChangesByEntryId(Identity.fromString(item.id)),
        ),
    );
    expect(returned).toEqual({
      changes: [
        {
          field: 'approvalStatus',
          previousValue: 'approved',
          newValue: 'pending',
        },
        { field: 'reviewedBy', previousValue: actor.name, newValue: '' },
      ],
      subject: { field: 'trackingNumber', value: newTrackingNumber },
    });
    expect(edited).toEqual({
      changes: [
        {
          field: 'trackingNumber',
          previousValue: bom.trackingNumber().asString(),
          newValue: newTrackingNumber,
        },
      ],
      subject: null,
    });
  });

  it('records an edit of a rejected BOM’s return to pending with its management note cleared', async () => {
    const bom = await savedBom(`MI-${randomUUID()}`);
    await reject(bom);

    await editTrackingNumber(bom, Role.QcInspector, `TRK-${randomUUID()}`);

    const { items } = await newestFirstEntriesFor(bom);
    const returned = await auditLog.findChangesByEntryId(
      Identity.fromString(items[0].id),
    );
    expect(items[0].action).toBe('ReturnedToPending');
    expect(returned?.changes).toContainEqual({
      field: 'managementNote',
      previousValue: REASON,
      newValue: '',
    });
  });

  it('records an edit of a pending daily BOM as an Edited entry alone', async () => {
    const bom = await savedBom(`MI-${randomUUID()}`);

    await editTrackingNumber(bom, Role.QcInspector, `TRK-${randomUUID()}`);

    const { items } = await newestFirstEntriesFor(bom);
    expect(items.map((item) => item.action)).toEqual(['Edited']);
  });

  it('lets only one of two concurrent reviews of a pending BOM through, refusing the other as already reviewed', async () => {
    const bom = await savedBom(`MI-${randomUUID()}`);

    const outcomes = await Promise.allSettled([approve(bom), reject(bom)]);

    const refused = outcomes.filter((outcome) => outcome.status === 'rejected');
    expect(refused).toHaveLength(1);
    expect(refused[0].reason).toBeInstanceOf(BomAlreadyReviewed);
    const { items } = await newestFirstEntriesFor(bom);
    expect(items).toHaveLength(1);
    expect(['Approved', 'Rejected']).toContain(items[0].action);
  });

  it('serialises an edit racing an approval: neither write is lost, and the stored review matches the audit trail', async () => {
    const bom = await savedBom(`MI-${randomUUID()}`);
    const newTrackingNumber = `TRK-${randomUUID()}`;

    await Promise.all([
      approve(bom),
      editTrackingNumber(bom, Role.QcInspector, newTrackingNumber),
    ]);

    const row = await prisma.bom.findUniqueOrThrow({
      where: { id: bom.id.asString() },
      select: { trackingNumber: true, approvalStatus: true },
    });
    const { items } = await newestFirstEntriesFor(bom);
    const actions = items.map((item) => item.action);
    // The edit always stands. Approved after the edit: still approved.
    // Approved before it: the edit sent it back to pending, and says so.
    expect(row.trackingNumber).toBe(newTrackingNumber);
    expect(
      actions[0] === AuditAction.Approved
        ? row.approvalStatus === 'approved'
        : row.approvalStatus === 'pending' &&
            actions.join(',') === 'ReturnedToPending,Edited,Approved',
    ).toBe(true);
  });

  it('rolls back the approval when its audit entry cannot be written', async () => {
    const bom = await savedBom(`MI-${randomUUID()}`);
    jest
      .spyOn(auditLog, 'record')
      .mockRejectedValueOnce(new Error('audit store unavailable'));

    await expect(approve(bom)).rejects.toThrow('audit store unavailable');

    expect(await bomRow(bom)).toEqual(
      expect.objectContaining({ approvalStatus: 'pending', reviewedBy: null }),
    );
    expect(await auditEntriesFor(bom)).toEqual([]);
  });

  it("reads a name among the report's reviewers as that reviewer's approvals and rejections, and '' as a pending BOM", async () => {
    const miCode = `MI-${randomUUID()}`;
    const approved = await savedBom(miCode);
    const rejected = await savedBom(miCode);
    const pending = await savedBom(miCode);
    await approve(approved);
    await reject(rejected);

    const onlyPending = await reports.search({
      page: 1,
      pageSize: 10,
      filters: { standardBomMiCodes: [miCode], reviewers: [''] },
    });
    const byReviewer = await reports.search({
      page: 1,
      pageSize: 10,
      filters: { standardBomMiCodes: [miCode], reviewers: [actor.name] },
    });

    expect(onlyPending.items.map((item) => item.id)).toEqual([
      pending.id.asString(),
    ]);
    // They share the pinned test clock's `createdAt`, so their order is not
    // part of what is checked here.
    expect(byReviewer.items.map((item) => item.id)).toHaveLength(2);
    expect(byReviewer.items.map((item) => item.id)).toEqual(
      expect.arrayContaining([approved.id.asString(), rejected.id.asString()]),
    );
  });
});
