import { randomUUID } from 'node:crypto';

import { AuditLoggingModule } from '@audit-logging/infrastructure/audit-logging.module';
import {
  RecordDependencies,
  RecordHasDependents,
} from '@framework/application';
import { EntityNotFound, Identity, Role } from '@framework/domain';
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
import { AssignQcActivityCommand } from '@maintenance/application/commands/assign-qc-activity/assign-qc-activity.command';
import { DefineQcActivityCommand } from '@maintenance/application/commands/define-qc-activity/define-qc-activity.command';
import { DeleteEquipmentCommand } from '@maintenance/application/commands/delete-equipment/delete-equipment.command';
import { DeleteQcActivityCommand } from '@maintenance/application/commands/delete-qc-activity/delete-qc-activity.command';
import { RecordQcExecutionCommand } from '@maintenance/application/commands/record-qc-execution/record-qc-execution.command';
import { RegisterEquipmentCommand } from '@maintenance/application/commands/register-equipment/register-equipment.command';
import { RetireEquipmentCommand } from '@maintenance/application/commands/retire-equipment/retire-equipment.command';
import { UnassignQcActivityCommand } from '@maintenance/application/commands/unassign-qc-activity/unassign-qc-activity.command';
import {
  EquipmentChangedConcurrently,
  QcActivityStillReferenced,
} from '@maintenance/application/exceptions';
import { QcAssignmentReader } from '@maintenance/application/service/qc-assignment-reader';
import { QcExecutionFilter } from '@maintenance/application/service/qc-execution-filter';
import { QcExecutionReader } from '@maintenance/application/service/qc-execution-reader';
import { QcActivityAlreadyAssigned } from '@maintenance/domain/exceptions/qc-activity-already-assigned.exception';
import { QcExecution } from '@maintenance/domain/qc-execution.aggregate';
import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { QcActivityRepository } from '@maintenance/domain/service/qc-activity.repository';
import { QcExecutionRepository } from '@maintenance/domain/service/qc-execution.repository';
import { EquipmentName } from '@maintenance/domain/value/equipment-name.vo';
import { QcActivityName } from '@maintenance/domain/value/qc-activity-name.vo';
import { QcTrackingNumber } from '@maintenance/domain/value/qc-tracking-number.vo';
import { MaintenanceModule } from '@maintenance/infrastructure/maintenance.module';
import { ConfigModule } from '@nestjs/config';
import { CommandBus, CqrsModule } from '@nestjs/cqrs';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Request, Response } from 'express';

// Production QC (issue #119) against Postgres, through the real module graph
// (no HTTP): each change and its audit entry commit or roll back together
// (ADR 0007's fitness function); assignments persist as a diff against what
// was loaded, with the unique key as the backstop for two at once; the
// foreign keys refuse deleting an activity still referenced; the reader's
// "previous record" is a window over every record of a pair, tied by
// `sequence`; the probe's kinds; and the System Admin's delete of retired
// equipment taking its QC rows. Every case uses fresh ids and names and
// deletes its own rows; nothing truncates.

const UNUSABLE_HASH = 'not-a-bcrypt-hash';
const AT_08_00 = new Date('2026-09-23T04:30:00.000Z');
const AT_09_00 = new Date('2026-09-23T05:30:00.000Z');
const AT_10_00 = new Date('2026-09-23T06:30:00.000Z');
const NEXT_DAY_11_20 = new Date('2026-09-24T07:50:00.000Z');

const NO_FILTER = {
  from: null,
  to: null,
  equipmentId: null,
  activityId: null,
  performedById: null,
  trackingNumber: null,
};

describe('production QC against Postgres', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let commandBus: CommandBus;
  let jwt: JwtService;
  let actorMiddleware: ActorContextMiddleware;
  let equipmentRepository: EquipmentRepository;
  let activityRepository: QcActivityRepository;
  let executionRepository: QcExecutionRepository;
  let reader: QcExecutionReader;
  let assignmentReader: QcAssignmentReader;
  let recordDependencies: RecordDependencies;
  let actorId: string;

  let equipmentIds: string[] = [];
  let activityIds: string[] = [];
  let userIds: string[] = [];

  /** Runs `work` the way a request does, as `userId`, so it is audited. */
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

  function execute<T = void>(command: object): Promise<T> {
    return runAs(actorId, () => commandBus.execute(command));
  }

  async function createUser(): Promise<string> {
    const id = randomUUID();
    userIds.push(id);
    await prisma.user.create({
      data: {
        id,
        name: `بازرس ${id}`,
        username: `qc-${id}`,
        passwordHash: UNUSABLE_HASH,
        role: Role.SystemAdmin,
      },
    });
    return id;
  }

  async function equipment(): Promise<Identity> {
    const { id } = await execute<{ id: string }>(
      new RegisterEquipmentCommand(
        EquipmentName.fromString(`اکسترودر ${randomUUID()}`),
      ),
    );
    equipmentIds.push(id);
    return Identity.fromString(id);
  }

  async function qcActivity(): Promise<Identity> {
    const { id } = await execute<{ id: string }>(
      new DefineQcActivityCommand(
        QcActivityName.fromString(`بازرسی ${randomUUID()}`),
      ),
    );
    activityIds.push(id);
    return Identity.fromString(id);
  }

  /** A record at `performedAt`, saved directly, with no event. */
  async function recordAt(
    equipmentId: Identity,
    activityId: Identity,
    performedAt: Date,
    trackingNumber = 'TR-100',
  ): Promise<string> {
    const execution = QcExecution.fromPersistence(Identity.new(), {
      equipmentId,
      activityId,
      performedById: Identity.fromString(actorId),
      performedByName: 'نیکروش',
      performedAt,
      trackingNumber: QcTrackingNumber.fromString(trackingNumber),
      notes: null,
    });
    await executionRepository.save(execution);
    return execution.id.asString();
  }

  function auditEntriesFor(recordId: string) {
    return prisma.auditLogEntry.findMany({
      where: { recordId },
      include: { changes: { orderBy: { position: 'asc' } } },
      orderBy: [{ occurredAt: 'asc' }, { sequence: 'asc' }],
    });
  }

  function assignmentsOf(equipmentId: Identity) {
    return prisma.qcAssignment.findMany({
      where: { equipmentId: equipmentId.asString() },
      orderBy: { qcActivityId: 'asc' },
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
        MaintenanceModule,
        AuditLoggingModule,
      ],
    }).compile();
    await moduleRef.init();

    prisma = moduleRef.get(PrismaService, { strict: false });
    commandBus = moduleRef.get(CommandBus, { strict: false });
    jwt = moduleRef.get(JwtService, { strict: false });
    actorMiddleware = moduleRef.get(ActorContextMiddleware, { strict: false });
    equipmentRepository = moduleRef.get(EquipmentRepository, { strict: false });
    activityRepository = moduleRef.get(QcActivityRepository, { strict: false });
    executionRepository = moduleRef.get(QcExecutionRepository, {
      strict: false,
    });
    reader = moduleRef.get(QcExecutionReader, { strict: false });
    assignmentReader = moduleRef.get(QcAssignmentReader, { strict: false });
    recordDependencies = moduleRef.get(RecordDependencies, { strict: false });
  });

  beforeEach(async () => {
    actorId = await createUser();
  });

  afterEach(async () => {
    const recordIds = [...equipmentIds, ...activityIds];
    const executions = await prisma.qcExecution.findMany({
      where: {
        OR: [
          { equipmentId: { in: equipmentIds } },
          { qcActivityId: { in: activityIds } },
        ],
      },
      select: { id: true },
    });
    await prisma.auditLogEntry.deleteMany({
      where: {
        recordId: { in: [...recordIds, ...executions.map(({ id }) => id)] },
      },
    });
    await prisma.qcExecution.deleteMany({
      where: { id: { in: executions.map(({ id }) => id) } },
    });
    await prisma.qcAssignment.deleteMany({
      where: {
        OR: [
          { equipmentId: { in: equipmentIds } },
          { qcActivityId: { in: activityIds } },
        ],
      },
    });
    await prisma.equipment.deleteMany({ where: { id: { in: equipmentIds } } });
    await prisma.qcActivity.deleteMany({ where: { id: { in: activityIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    equipmentIds = [];
    activityIds = [];
    userIds = [];
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  describe('auditability (ADR 0007)', () => {
    it('writes each QC change with its audit entry: a definition, an assignment and a record', async () => {
      const extruder = await equipment();
      const dimensional = await qcActivity();

      await execute(new AssignQcActivityCommand(extruder, dimensional));
      const { id: recordId } = await execute<{ id: string }>(
        new RecordQcExecutionCommand(
          extruder,
          dimensional,
          Identity.fromString(actorId),
          QcTrackingNumber.fromString('TR-100'),
          'خراش جزئی',
        ),
      );

      const [defined] = await auditEntriesFor(dimensional.asString());
      expect(defined).toMatchObject({
        recordType: 'QcActivity',
        action: 'Registered',
        actorId,
      });
      const equipmentEntries = await auditEntriesFor(extruder.asString());
      expect(equipmentEntries.at(-1)).toMatchObject({
        recordType: 'Equipment',
        action: 'Edited',
        subjectField: 'name',
      });
      expect(equipmentEntries.at(-1)?.changes).toMatchObject([
        { field: 'qcActivity', previousValue: '' },
      ]);
      const [recorded] = await auditEntriesFor(recordId);
      expect(recorded).toMatchObject({
        recordType: 'QcExecution',
        action: 'Registered',
      });
      expect(recorded.changes.map((change) => change.field)).toEqual([
        'equipment',
        'activity',
        'performedAt',
        'performedBy',
        'trackingNumber',
        'notes',
      ]);
    });

    it('rolls an assignment back with its audit entry when the actor cannot be named', async () => {
      const extruder = await equipment();
      const dimensional = await qcActivity();
      const ghost = randomUUID();

      await expect(
        runAs(ghost, () =>
          commandBus.execute(
            new AssignQcActivityCommand(extruder, dimensional),
          ),
        ),
      ).rejects.toBeInstanceOf(EntityNotFound);

      expect(await assignmentsOf(extruder)).toEqual([]);
      const entries = await auditEntriesFor(extruder.asString());
      expect(entries.map((entry) => entry.action)).toEqual(['Registered']);
    });
  });

  describe('assignments', () => {
    it('round-trips an equipment’s QC activities, an unassignment deleting only its row', async () => {
      const extruder = await equipment();
      const dimensional = await qcActivity();
      const visual = await qcActivity();
      await execute(new AssignQcActivityCommand(extruder, dimensional));
      await execute(new AssignQcActivityCommand(extruder, visual));

      await execute(new UnassignQcActivityCommand(extruder, dimensional));

      const reloaded = await equipmentRepository.get(extruder);
      expect(reloaded.qcActivityIds()).toEqual([visual]);
    });

    it('never removes an assignment another request added after the load', async () => {
      const extruder = await equipment();
      const dimensional = await qcActivity();
      const visual = await qcActivity();
      const first = await equipmentRepository.get(extruder);
      const second = await equipmentRepository.get(extruder);
      first.assignQcActivity(await activityRepository.get(dimensional));
      second.assignQcActivity(await activityRepository.get(visual));

      await runAs(actorId, () => equipmentRepository.save(first));
      await runAs(actorId, () => equipmentRepository.save(second));

      const rows = await assignmentsOf(extruder);
      expect(rows.map((row) => row.qcActivityId)).toEqual(
        expect.arrayContaining([dimensional.asString(), visual.asString()]),
      );
      expect(rows).toHaveLength(2);
    });

    it('refuses a second assignment of one activity made at once, as already assigned', async () => {
      const extruder = await equipment();
      const dimensional = await qcActivity();
      const activity = await activityRepository.get(dimensional);
      const first = await equipmentRepository.get(extruder);
      const second = await equipmentRepository.get(extruder);
      first.assignQcActivity(activity);
      second.assignQcActivity(activity);
      await runAs(actorId, () => equipmentRepository.save(first));

      await expect(
        runAs(actorId, () => equipmentRepository.save(second)),
      ).rejects.toBeInstanceOf(QcActivityAlreadyAssigned);
      expect(await assignmentsOf(extruder)).toHaveLength(1);
    });

    it('counts each activity’s equipment and each equipment’s activities in one read', async () => {
      const extruder = await equipment();
      const press = await equipment();
      const dimensional = await qcActivity();
      await execute(new AssignQcActivityCommand(extruder, dimensional));
      await execute(new AssignQcActivityCommand(press, dimensional));
      await execute(new RetireEquipmentCommand(press));

      const activities = await assignmentReader.activities();
      const equipmentCounts = await assignmentReader.equipment();

      expect(
        activities.find((row) => row.id === dimensional.asString()),
      ).toMatchObject({ assignedEquipmentCount: 2 });
      expect(
        equipmentCounts.find((row) => row.id === press.asString()),
      ).toMatchObject({ retired: true, assignedActivityCount: 1 });
      expect(
        equipmentCounts.find((row) => row.id === extruder.asString()),
      ).toMatchObject({ retired: false, assignedActivityCount: 1 });
    });
  });

  describe('the dependency rule', () => {
    it('answers an activity’s assignments by name and its records counted unnamed, even once unassigned', async () => {
      const extruder = await equipment();
      const dimensional = await qcActivity();
      await execute(new AssignQcActivityCommand(extruder, dimensional));
      await recordAt(extruder, dimensional, AT_08_00);
      await recordAt(extruder, dimensional, AT_09_00);
      const stored = await equipmentRepository.get(extruder);
      const equipmentName = stored.name().asString();

      expect(
        await recordDependencies.dependentsOf({
          type: 'qc-activity',
          id: dimensional.asString(),
        }),
      ).toEqual([
        { kind: 'qc-assigned-equipment', count: 1, names: [equipmentName] },
        { kind: 'qc-activity-execution', count: 2, names: [] },
      ]);

      await execute(new UnassignQcActivityCommand(extruder, dimensional));
      expect(
        await recordDependencies.dependentsOf({
          type: 'Equipment',
          id: extruder.asString(),
        }),
      ).toEqual([{ kind: 'qc-equipment-execution', count: 2, names: [] }]);
    });

    it('refuses deleting an activity still recorded, through the guard', async () => {
      const extruder = await equipment();
      const dimensional = await qcActivity();
      await execute(new AssignQcActivityCommand(extruder, dimensional));
      await recordAt(extruder, dimensional, AT_08_00);
      await execute(new UnassignQcActivityCommand(extruder, dimensional));

      await expect(
        execute(new DeleteQcActivityCommand(dimensional)),
      ).rejects.toBeInstanceOf(RecordHasDependents);
      expect(await activityRepository.find(dimensional)).not.toBeNull();
    });

    it('has the foreign key refuse deleting an activity the guard did not see referenced', async () => {
      const extruder = await equipment();
      const dimensional = await qcActivity();
      const activity = await activityRepository.get(dimensional);
      await prisma.qcAssignment.create({
        data: {
          equipmentId: extruder.asString(),
          qcActivityId: dimensional.asString(),
        },
      });
      activity.delete();

      await expect(
        runAs(actorId, () => activityRepository.delete(activity)),
      ).rejects.toBeInstanceOf(QcActivityStillReferenced);
      expect(await activityRepository.find(dimensional)).not.toBeNull();
    });
  });

  describe('the records’ read side', () => {
    it('measures each record from the previous one of its own pair over every record, whatever the filter', async () => {
      const extruder = await equipment();
      const other = await equipment();
      const dimensional = await qcActivity();
      const visual = await qcActivity();
      await recordAt(extruder, dimensional, AT_08_00, 'TR-100');
      await recordAt(extruder, visual, AT_09_00, 'TR-100');
      await recordAt(other, dimensional, AT_09_00, 'TR-200');
      await recordAt(extruder, dimensional, AT_10_00, 'TR-101');

      const rows = await reader.matching(
        QcExecutionFilter.of({
          ...NO_FILTER,
          equipmentId: extruder,
          from: AT_09_00,
          trackingNumber: 'tr-101',
        }),
      );

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        activityId: dimensional.asString(),
        trackingNumber: 'TR-101',
        previousPerformedAt: AT_08_00,
      });
    });

    it('orders records made at one instant by the order they were made, oldest first', async () => {
      const extruder = await equipment();
      const dimensional = await qcActivity();
      const first = await recordAt(extruder, dimensional, AT_08_00);
      const second = await recordAt(extruder, dimensional, AT_08_00);
      const third = await recordAt(extruder, dimensional, NEXT_DAY_11_20);

      const rows = await reader.matching(
        QcExecutionFilter.of({ ...NO_FILTER, equipmentId: extruder }),
      );

      expect(rows.map((row) => row.id)).toEqual([first, second, third]);
      expect(rows.map((row) => row.previousPerformedAt)).toEqual([
        null,
        AT_08_00,
        AT_08_00,
      ]);
    });

    it('joins the equipment’s and the activity’s current names', async () => {
      const extruder = await equipment();
      const dimensional = await qcActivity();
      await recordAt(extruder, dimensional, AT_08_00);
      await prisma.equipment.update({
        where: { id: extruder.asString() },
        data: { name: `اکسترودر خط یک ${randomUUID()}` },
      });
      const current = await equipmentRepository.get(extruder);

      const [row] = await reader.matching(
        QcExecutionFilter.of({ ...NO_FILTER, equipmentId: extruder }),
      );

      expect(row.equipmentName).toBe(current.name().asString());
    });

    it('answers each pair’s last record, and each performer once by their latest name', async () => {
      const extruder = await equipment();
      const dimensional = await qcActivity();
      await recordAt(extruder, dimensional, AT_10_00);
      await recordAt(extruder, dimensional, AT_08_00);

      expect(await reader.lastPerformed([extruder])).toEqual([
        {
          equipmentId: extruder.asString(),
          activityId: dimensional.asString(),
          performedAt: AT_10_00,
        },
      ]);
      const performers = await reader.performers();
      expect(
        performers.filter((performer) => performer.id === actorId),
      ).toEqual([{ id: actorId, name: 'نیکروش' }]);
    });
  });

  // Code review: a QC record committed after the cascade listed the
  // equipment's records makes the foreign key refuse the equipment's delete.
  // That is a concurrent change — a 409 to retry — not a 500.
  it('refuses deleting equipment that has a QC record the cascade did not see, as changed concurrently', async () => {
    const extruder = await equipment();
    const dimensional = await qcActivity();
    await execute(new AssignQcActivityCommand(extruder, dimensional));
    await recordAt(extruder, dimensional, AT_08_00);
    await execute(new RetireEquipmentCommand(extruder));
    const retired = await equipmentRepository.get(extruder);
    retired.delete();

    await expect(
      runAs(actorId, () => equipmentRepository.delete(retired)),
    ).rejects.toBeInstanceOf(EquipmentChangedConcurrently);
    expect(await equipmentRepository.find(extruder)).not.toBeNull();
    expect(await assignmentsOf(extruder)).toHaveLength(1);
  });

  it('deletes retired equipment with its QC assignments and every QC record, each record audited', async () => {
    const extruder = await equipment();
    const other = await equipment();
    const dimensional = await qcActivity();
    await execute(new AssignQcActivityCommand(extruder, dimensional));
    await execute(new AssignQcActivityCommand(other, dimensional));
    const doomed = await recordAt(extruder, dimensional, AT_08_00);
    const kept = await recordAt(other, dimensional, AT_08_00);
    await execute(new RetireEquipmentCommand(extruder));

    await execute(new DeleteEquipmentCommand(extruder));

    expect(await equipmentRepository.find(extruder)).toBeNull();
    expect(await assignmentsOf(extruder)).toEqual([]);
    expect(await assignmentsOf(other)).toHaveLength(1);
    const remaining = await prisma.qcExecution.findMany({
      where: { id: { in: [doomed, kept] } },
      select: { id: true },
    });
    expect(remaining.map(({ id }) => id)).toEqual([kept]);
    const [deleted] = await auditEntriesFor(doomed);
    expect(deleted).toMatchObject({
      recordType: 'QcExecution',
      action: 'Deleted',
    });
  });
});
