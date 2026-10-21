import { randomUUID } from 'node:crypto';

import { AuditLogRepository } from '@audit-logging/application/service/audit-log.repository';
import { AuditLoggingModule } from '@audit-logging/infrastructure/audit-logging.module';
import { ApproveBomCommand } from '@boms/application/commands/approve-bom/approve-bom.command';
import { BomReportRepository } from '@boms/application/service/bom-report.repository';
import { Bom } from '@boms/domain/bom.aggregate';
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

// ADR 0007 for approval: approving a daily BOM and its `Approved` audit entry
// commit or roll back together — the same transactional path every other
// write takes, here driven through the real `ApproveBomHandler` on the
// `CommandBus`. Plus one real-Postgres check of the report filter's `''`
// approver (`approved_by IS NULL`), which a unit test can only assert as a
// Prisma `where` shape. Runs against the test stack's Postgres (see
// `make run-integration-tests`); every case uses fresh ids and a unique MI
// code and deletes its own rows; nothing truncates.

// Stored in app_user.password_hash for the test actor; never used to log in.
const UNUSABLE_HASH = 'not-a-bcrypt-hash';

describe('daily BOM approval', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let boms: BomRepository;
  let reports: BomReportRepository;
  let auditLog: AuditLogRepository;
  let commandBus: CommandBus;
  let jwt: JwtService;
  let actorMiddleware: ActorContextMiddleware;
  // Assigned in beforeAll, before any case runs.
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
  // each case sees only the entries its own approval wrote.
  async function savedBom(miCode: string): Promise<Bom> {
    const bom = Bom.register(
      Identity.new(),
      miCode,
      'Legrand',
      `Integration product ${randomUUID()}`,
      305,
      OrderNumber.fromString(`ORD-${randomUUID()}`),
      TrackingNumber.fromString(`TRK-${randomUUID()}`),
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

  function bomRow(bom: Bom) {
    return prisma.bom.findUnique({
      where: { id: bom.id.asString() },
      select: { approvalStatus: true, approvedBy: true },
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
    actor = { id, name: `Integration approver ${id}` };
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

  it('commits the approval and exactly one Approved audit entry carrying the status and approver lines', async () => {
    const bom = await savedBom(`MI-${randomUUID()}`);

    await runAs(actor.id, () =>
      commandBus.execute(new ApproveBomCommand(bom.id, actor.name)),
    );

    expect(await bomRow(bom)).toEqual({
      approvalStatus: 'approved',
      approvedBy: actor.name,
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
    expect(
      entries[0].changes.map(({ field, previousValue, newValue }) => ({
        field,
        previousValue,
        newValue,
      })),
    ).toEqual([
      {
        field: 'approvalStatus',
        previousValue: 'unapproved',
        newValue: 'approved',
      },
      { field: 'approvedBy', previousValue: '', newValue: actor.name },
    ]);
  });

  it('rolls back the approval when its audit entry cannot be written', async () => {
    const bom = await savedBom(`MI-${randomUUID()}`);
    jest
      .spyOn(auditLog, 'record')
      .mockRejectedValueOnce(new Error('audit store unavailable'));

    await expect(
      runAs(actor.id, () =>
        commandBus.execute(new ApproveBomCommand(bom.id, actor.name)),
      ),
    ).rejects.toThrow('audit store unavailable');

    expect(await bomRow(bom)).toEqual({
      approvalStatus: 'unapproved',
      approvedBy: null,
    });
    expect(await auditEntriesFor(bom)).toEqual([]);
  });

  it("reads '' among the report's approvers as a daily BOM with no approver", async () => {
    const miCode = `MI-${randomUUID()}`;
    const approved = await savedBom(miCode);
    const unapproved = await savedBom(miCode);
    await runAs(actor.id, () =>
      commandBus.execute(new ApproveBomCommand(approved.id, actor.name)),
    );

    const onlyUnapproved = await reports.search({
      page: 1,
      pageSize: 10,
      filters: { standardBomMiCodes: [miCode], approvers: [''] },
    });
    const approverOrUnapproved = await reports.search({
      page: 1,
      pageSize: 10,
      filters: { standardBomMiCodes: [miCode], approvers: [actor.name, ''] },
    });

    expect(onlyUnapproved.items.map((item) => item.id)).toEqual([
      unapproved.id.asString(),
    ]);
    // Both share the pinned test clock's `createdAt`, so their order is not
    // part of what is checked here.
    expect(approverOrUnapproved.items.map((item) => item.id)).toHaveLength(2);
    expect(approverOrUnapproved.items.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        approved.id.asString(),
        unapproved.id.asString(),
      ]),
    );
  });
});
