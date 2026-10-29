import { randomUUID } from 'node:crypto';

import { AuditLogRepository } from '@audit-logging/application/service/audit-log.repository';
import { AuditLoggingModule } from '@audit-logging/infrastructure/audit-logging.module';
import { UnitOfWork } from '@framework/application';
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
  TunableClock,
} from '@framework/infrastructure';
import { IdentityModule } from '@identity/infrastructure/identity.module';
import { ConfigModule } from '@nestjs/config';
import { CommandBus, CqrsModule } from '@nestjs/cqrs';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfirmMaterialImportCommand } from '@products/application/commands/confirm-material-import/confirm-material-import.command';
import { RevertMaterialImportCommand } from '@products/application/commands/revert-material-import/revert-material-import.command';
import { MaterialImportAlreadyReverted } from '@products/domain/exceptions/material-import-already-reverted.exception';
import { Material } from '@products/domain/material.aggregate';
import { MaterialRepository } from '@products/domain/service/material.repository';
import { MaterialImportRepository } from '@products/domain/service/material-import.repository';
import { MaterialCode } from '@products/domain/value/material-code.vo';
import { MaterialName } from '@products/domain/value/material-name.vo';
import { ProductsModule } from '@products/infrastructure/products.module';
import { Request, Response } from 'express';

// Issue #74 against the test stack's real Postgres (`make
// run-integration-tests`): confirming and reverting a material import each
// commit every material change, the import row and its one audit entry
// together, or none of them (ADR 0007); the shared advisory lock runs them
// one at a time; and a reversion's write is conditional on the row not being
// reverted yet. Fresh names and codes per case; each case deletes its rows.

const UNUSABLE_HASH = 'not-a-bcrypt-hash';
// Far past anything else in the shared test database, so the imports made
// here are always the latest ones still in place.
const LATER_THAN_ANY_OTHER_IMPORT = new Date('2999-01-01T00:00:00.000Z');

function doNothing(): void {}

describe('material import', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let commandBus: CommandBus;
  let materials: MaterialRepository;
  let materialImports: MaterialImportRepository;
  let auditLog: AuditLogRepository;
  let unitOfWork: UnitOfWork;
  let jwt: JwtService;
  let actorMiddleware: ActorContextMiddleware;
  let actorId: string;
  let createdImportIds: string[] = [];
  let suffix: string;

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

  /** A unique name or code for this case. */
  function unique(label: string): string {
    return `${label} ${suffix}`;
  }

  async function seedMaterial(name: string, code: string): Promise<Material> {
    const material = Material.register(
      MaterialName.fromString(name),
      MaterialCode.fromString(code),
    );
    await runAs(actorId, () => materials.save(material));
    return material;
  }

  async function confirm(rows: { name: string; code: string }[]) {
    const { id } = await runAs(actorId, () =>
      commandBus.execute<ConfirmMaterialImportCommand, { id: string }>(
        new ConfirmMaterialImportCommand(
          rows.map((row, index) => ({ row: index + 3, ...row })),
        ),
      ),
    );
    createdImportIds.push(id);
    return id;
  }

  function revert(importId: string): Promise<void> {
    return runAs(actorId, () =>
      commandBus.execute(
        new RevertMaterialImportCommand(Identity.fromString(importId)),
      ),
    );
  }

  function materialNamed(name: string) {
    return prisma.material.findUnique({ where: { name } });
  }

  function auditEntriesFor(recordId: string) {
    return prisma.auditLogEntry.findMany({
      where: { recordId },
      orderBy: [{ occurredAt: 'asc' }, { sequence: 'asc' }],
      include: { changes: { orderBy: { position: 'asc' } } },
    });
  }

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
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
        ProductsModule,
        AuditLoggingModule,
      ],
    }).compile();
    await moduleRef.init();

    prisma = moduleRef.get(PrismaService, { strict: false });
    commandBus = moduleRef.get(CommandBus, { strict: false });
    materials = moduleRef.get(MaterialRepository, { strict: false });
    materialImports = moduleRef.get(MaterialImportRepository, {
      strict: false,
    });
    auditLog = moduleRef.get(AuditLogRepository, { strict: false });
    unitOfWork = moduleRef.get(UnitOfWork, { strict: false });
    jwt = moduleRef.get(JwtService, { strict: false });
    actorMiddleware = moduleRef.get(ActorContextMiddleware, { strict: false });
    moduleRef
      .get(TunableClock, { strict: false })
      .set(LATER_THAN_ANY_OTHER_IMPORT);

    actorId = randomUUID();
    await prisma.user.create({
      data: {
        id: actorId,
        name: `Import actor ${actorId}`,
        username: `import-${actorId}`,
        passwordHash: UNUSABLE_HASH,
        role: Role.SystemAdmin,
      },
    });
  });

  beforeEach(() => {
    suffix = randomUUID();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    const materialRows = await prisma.material.findMany({
      where: {
        OR: [{ name: { endsWith: suffix } }, { code: { endsWith: suffix } }],
      },
    });
    const materialIds = materialRows.map((row) => row.id);
    await prisma.auditLogEntry.deleteMany({
      where: { recordId: { in: [...createdImportIds, ...materialIds] } },
    });
    await prisma.materialImport.deleteMany({
      where: { id: { in: createdImportIds } },
    });
    await prisma.material.deleteMany({ where: { id: { in: materialIds } } });
    createdImportIds = [];
  });

  afterAll(async () => {
    if (actorId) {
      await prisma?.user.deleteMany({ where: { id: actorId } });
    }
    await moduleRef?.close();
  });

  it('commits the changes, the import and its one Imported audit entry together', async () => {
    const copper = await seedMaterial(unique('مسی'), unique('M-101'));

    const importId = await confirm([
      { name: unique('آلومینیوم'), code: unique('A-1') },
      { name: unique('مسی'), code: unique('M-201') },
    ]);

    expect(await materialNamed(unique('آلومینیوم'))).toEqual(
      expect.objectContaining({ code: unique('A-1') }),
    );
    expect(await materialNamed(unique('مسی'))).toEqual(
      expect.objectContaining({ code: unique('M-201') }),
    );
    const stored = await materialImports.get(Identity.fromString(importId));
    expect(stored.changes().map((change) => change.kind())).toEqual([
      'register',
      'changeCode',
    ]);
    const [entry, ...others] = await auditEntriesFor(importId);
    expect(others).toEqual([]);
    expect(entry).toEqual(
      expect.objectContaining({
        recordType: 'MaterialImport',
        action: 'Imported',
        actorId,
      }),
    );
    expect(
      entry.changes.map(({ field, previousValue, newValue }) => ({
        field,
        previousValue,
        newValue,
      })),
    ).toEqual([
      {
        field: `importedMaterial:${unique('A-1')}`,
        previousValue: '',
        newValue: unique('آلومینیوم'),
      },
      {
        field: `materialCode:${unique('مسی')}`,
        previousValue: unique('M-101'),
        newValue: unique('M-201'),
      },
    ]);
    // None per material: the copper's only entry is its own registration.
    const copperEntries = await auditEntriesFor(copper.id.asString());
    expect(copperEntries.map((each) => each.action)).toEqual(['Registered']);
  });

  it('rolls back every change and the import when its audit entry cannot be written', async () => {
    await seedMaterial(unique('مسی'), unique('M-101'));
    const importsBefore = await prisma.materialImport.count();
    jest
      .spyOn(auditLog, 'record')
      .mockRejectedValueOnce(new Error('audit store unavailable'));

    await expect(
      confirm([
        { name: unique('آلومینیوم'), code: unique('A-1') },
        { name: unique('مسی'), code: unique('M-201') },
      ]),
    ).rejects.toThrow('audit store unavailable');

    expect(await materialNamed(unique('آلومینیوم'))).toBeNull();
    expect(await materialNamed(unique('مسی'))).toEqual(
      expect.objectContaining({ code: unique('M-101') }),
    );
    expect(await prisma.materialImport.count()).toBe(importsBefore);
  });

  it('commits the undo, the reversion and its Reverted audit entry together', async () => {
    await seedMaterial(unique('مسی'), unique('M-101'));
    const importId = await confirm([
      { name: unique('آلومینیوم'), code: unique('A-1') },
      { name: unique('مسی'), code: unique('M-201') },
    ]);

    await revert(importId);

    expect(await materialNamed(unique('آلومینیوم'))).toBeNull();
    expect(await materialNamed(unique('مسی'))).toEqual(
      expect.objectContaining({ code: unique('M-101') }),
    );
    expect(
      await prisma.materialImport.findUnique({ where: { id: importId } }),
    ).toEqual(
      expect.objectContaining({ revertedAt: LATER_THAN_ANY_OTHER_IMPORT }),
    );
    const entries = await auditEntriesFor(importId);
    expect(entries.map((each) => each.action)).toEqual([
      'Imported',
      'Reverted',
    ]);
    expect(
      entries[1].changes.map(({ field, previousValue, newValue }) => ({
        field,
        previousValue,
        newValue,
      })),
    ).toEqual([
      {
        field: `importedMaterial:${unique('A-1')}`,
        previousValue: unique('آلومینیوم'),
        newValue: '',
      },
      {
        field: `materialCode:${unique('مسی')}`,
        previousValue: unique('M-201'),
        newValue: unique('M-101'),
      },
    ]);
  });

  it('rolls back the whole reversion when its audit entry cannot be written', async () => {
    await seedMaterial(unique('مسی'), unique('M-101'));
    const importId = await confirm([
      { name: unique('آلومینیوم'), code: unique('A-1') },
      { name: unique('مسی'), code: unique('M-201') },
    ]);
    jest
      .spyOn(auditLog, 'record')
      .mockRejectedValueOnce(new Error('audit store unavailable'));

    await expect(revert(importId)).rejects.toThrow('audit store unavailable');

    expect(await materialNamed(unique('آلومینیوم'))).not.toBeNull();
    expect(await materialNamed(unique('مسی'))).toEqual(
      expect.objectContaining({ code: unique('M-201') }),
    );
    expect(
      await prisma.materialImport.findUnique({ where: { id: importId } }),
    ).toEqual(expect.objectContaining({ revertedAt: null }));
  });

  it('refuses saving a reversion over one already committed, through the conditional write', async () => {
    const importId = await confirm([
      { name: unique('آلومینیوم'), code: unique('A-1') },
    ]);
    const staleCopy = await materialImports.get(Identity.fromString(importId));
    await revert(importId);
    staleCopy.revert(LATER_THAN_ANY_OTHER_IMPORT);

    await expect(
      runAs(actorId, () => materialImports.save(staleCopy)),
    ).rejects.toBeInstanceOf(MaterialImportAlreadyReverted);
    const entries = await auditEntriesFor(importId);
    expect(entries.map((each) => each.action)).toEqual([
      'Imported',
      'Reverted',
    ]);
  });

  it('runs units of work sharing a lock key one at a time', async () => {
    const lockKey = unique('lock');
    const order: string[] = [];
    let releaseFirst: () => void = doNothing;
    const firstMayFinish = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let firstStarted: () => void = doNothing;
    const firstHasLock = new Promise<void>((resolve) => {
      firstStarted = resolve;
    });

    const first = unitOfWork.runExclusively(lockKey, async () => {
      order.push('first starts');
      firstStarted();
      await firstMayFinish;
      order.push('first ends');
    });
    await firstHasLock;
    const second = unitOfWork.runExclusively(lockKey, () => {
      order.push('second starts');
      return Promise.resolve();
    });
    // Give the second every chance to start early, were it not blocked.
    await new Promise((resolve) => setTimeout(resolve, 300));
    releaseFirst();
    await Promise.all([first, second]);

    expect(order).toEqual(['first starts', 'first ends', 'second starts']);
  });
});
