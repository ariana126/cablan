import { randomUUID } from 'node:crypto';

import { AuditLoggingModule } from '@audit-logging/infrastructure/audit-logging.module';
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
import { AddPmPlanItemCommand } from '@maintenance/application/commands/add-pm-plan-item/add-pm-plan-item.command';
import { ChangePmPlanItemIntervalCommand } from '@maintenance/application/commands/change-pm-plan-item-interval/change-pm-plan-item-interval.command';
import { DeactivatePmPlanItemCommand } from '@maintenance/application/commands/deactivate-pm-plan-item/deactivate-pm-plan-item.command';
import { RecordMaintenanceExecutionCommand } from '@maintenance/application/commands/record-maintenance-execution/record-maintenance-execution.command';
import { RegisterEquipmentCommand } from '@maintenance/application/commands/register-equipment/register-equipment.command';
import { RegisterMaintenanceActivityCommand } from '@maintenance/application/commands/register-maintenance-activity/register-maintenance-activity.command';
import {
  EquipmentChangedConcurrently,
  EquipmentNameTaken,
} from '@maintenance/application/exceptions';
import { Equipment } from '@maintenance/domain/equipment.aggregate';
import { ActivityAlreadyInPmPlan } from '@maintenance/domain/exceptions/activity-already-in-pm-plan.exception';
import { PmOccurrenceAlreadyRecorded } from '@maintenance/domain/exceptions/pm-occurrence-already-recorded.exception';
import { MaintenanceActivity } from '@maintenance/domain/maintenance-activity.aggregate';
import { MaintenanceExecution } from '@maintenance/domain/maintenance-execution.aggregate';
import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { MaintenanceActivityRepository } from '@maintenance/domain/service/maintenance-activity.repository';
import { MaintenanceExecutionRepository } from '@maintenance/domain/service/maintenance-execution.repository';
import { CalendarDate } from '@maintenance/domain/value/calendar-date.vo';
import { CalendarDateRange } from '@maintenance/domain/value/calendar-date-range.vo';
import { EquipmentName } from '@maintenance/domain/value/equipment-name.vo';
import { IntervalDays } from '@maintenance/domain/value/interval-days.vo';
import { IntervalUnit } from '@maintenance/domain/value/interval-unit';
import { MaintenanceActivityName } from '@maintenance/domain/value/maintenance-activity-name.vo';
import { MaintenanceModule } from '@maintenance/infrastructure/maintenance.module';
import { ConfigModule } from '@nestjs/config';
import { CommandBus, CqrsModule } from '@nestjs/cqrs';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Request, Response } from 'express';

// What a unit spec cannot show about the maintenance module: its aggregates
// round-trip through Postgres (the plan items' JSON schedule, their order,
// a `date` column), its unique indexes refuse what two racing writes would
// both get past the domain's checks — surfacing as the domain's own 409
// exceptions — and its writes commit with their audit entries (ADR 0007).
// Runs against the test stack's Postgres; every case uses fresh names and
// deletes its own rows.

const UNUSABLE_HASH = '$2b$10$integration.tests.never.log.in.with.this.x';

function byText(left: string, right: string): number {
  return left.localeCompare(right);
}

/** The ids of `executions`, in one fixed order to compare against. */
function idsOf(executions: readonly MaintenanceExecution[]): string[] {
  return executions
    .map((execution) => execution.id.asString())
    .toSorted(byText);
}

describe('maintenance persistence', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let commandBus: CommandBus;
  let equipmentRepository: EquipmentRepository;
  let activityRepository: MaintenanceActivityRepository;
  let executionRepository: MaintenanceExecutionRepository;
  let jwt: JwtService;
  let actorMiddleware: ActorContextMiddleware;
  let actorId: string;
  let equipmentIds: string[] = [];
  let activityIds: string[] = [];

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

  function execute<T>(command: object): Promise<T> {
    return runAs(actorId, () => commandBus.execute<object, T>(command));
  }

  async function registeredEquipment(): Promise<string> {
    const { id } = await execute<{ id: string }>(
      new RegisterEquipmentCommand(
        EquipmentName.fromString(`تجهیز ${randomUUID()}`),
      ),
    );
    equipmentIds.push(id);
    return id;
  }

  async function registeredActivity(): Promise<string> {
    const { id } = await execute<{ id: string }>(
      new RegisterMaintenanceActivityCommand(
        MaintenanceActivityName.fromString(`فعالیت ${randomUUID()}`),
      ),
    );
    activityIds.push(id);
    return id;
  }

  // A writer that loads the plan and adds `activity` to it, not yet saved —
  // two of them stand for two requests racing on one equipment.
  async function loadedWithPlanItem(
    equipmentId: string,
    activity: MaintenanceActivity,
  ): Promise<Equipment> {
    const equipment = await equipmentRepository.get(
      Identity.fromString(equipmentId),
    );
    equipment.addPlanItem(
      activity,
      IntervalDays.of(7),
      CalendarDate.fromString('2026-07-01'),
    );
    return equipment;
  }

  async function planItemOf(
    equipmentId: string,
    activityId: string,
    intervalDays: number,
    firstDueDate: string,
  ): Promise<string> {
    const { id } = await execute<{ id: string }>(
      new AddPmPlanItemCommand(
        Identity.fromString(equipmentId),
        Identity.fromString(activityId),
        intervalDays,
        IntervalUnit.Days,
        CalendarDate.fromString(firstDueDate),
      ),
    );
    return id;
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
    equipmentRepository = moduleRef.get(EquipmentRepository, { strict: false });
    activityRepository = moduleRef.get(MaintenanceActivityRepository, {
      strict: false,
    });
    executionRepository = moduleRef.get(MaintenanceExecutionRepository, {
      strict: false,
    });
    jwt = moduleRef.get(JwtService, { strict: false });
    actorMiddleware = moduleRef.get(ActorContextMiddleware, { strict: false });

    actorId = randomUUID();
    await prisma.user.create({
      data: {
        id: actorId,
        name: `مسلمی ${actorId}`,
        username: `integration-${actorId}`,
        passwordHash: UNUSABLE_HASH,
        role: Role.PmInspector,
      },
    });
  });

  afterEach(async () => {
    const executions = await prisma.maintenanceExecution.findMany({
      where: { equipmentId: { in: equipmentIds } },
      select: { id: true },
    });
    const planItems = await prisma.pmPlanItem.findMany({
      where: { equipmentId: { in: equipmentIds } },
      select: { id: true },
    });
    await prisma.auditLogEntry.deleteMany({
      where: {
        recordId: {
          in: [
            ...equipmentIds,
            ...activityIds,
            ...executions.map((row) => row.id),
            ...planItems.map((row) => row.id),
          ],
        },
      },
    });
    await prisma.maintenanceExecution.deleteMany({
      where: { equipmentId: { in: equipmentIds } },
    });
    await prisma.equipment.deleteMany({ where: { id: { in: equipmentIds } } });
    await prisma.maintenanceActivity.deleteMany({
      where: { id: { in: activityIds } },
    });
    equipmentIds = [];
    activityIds = [];
  });

  afterAll(async () => {
    await prisma?.user.deleteMany({ where: { id: actorId } });
    await moduleRef?.close();
  });

  it('round-trips equipment with its plan items — order, schedule segments, deactivation', async () => {
    const equipmentId = await registeredEquipment();
    const oilChange = await registeredActivity();
    const greasing = await registeredActivity();
    const first = await planItemOf(equipmentId, oilChange, 30, '2026-07-01');
    const second = await planItemOf(equipmentId, greasing, 7, '2026-07-02');
    await execute(
      new ChangePmPlanItemIntervalCommand(
        Identity.fromString(equipmentId),
        Identity.fromString(first),
        15,
      ),
    );
    await execute(
      new DeactivatePmPlanItemCommand(
        Identity.fromString(equipmentId),
        Identity.fromString(second),
      ),
    );

    const equipment = await equipmentRepository.get(
      Identity.fromString(equipmentId),
    );

    expect(equipment.planItems().map((item) => item.id.asString())).toEqual([
      first,
      second,
    ]);
    expect(
      equipment.activePlanItems().map((item) => item.id.asString()),
    ).toEqual([first]);
    expect(
      equipment.inactivePlanItems().map((item) => item.id.asString()),
    ).toEqual([second]);
    expect(equipment.planItems()[1].deactivatedAt()).toBeInstanceOf(Date);
    expect(
      equipment
        .planItems()[0]
        .schedule()
        .segments()
        .map((segment) => segment.intervalDays.asNumber()),
    ).toContain(15);
  });

  it('writes an audit entry with every change, by the acting user', async () => {
    const equipmentId = await registeredEquipment();
    const activityId = await registeredActivity();
    const itemId = await planItemOf(equipmentId, activityId, 30, '2026-07-01');

    const entries = await prisma.auditLogEntry.findMany({
      where: { recordId: { in: [equipmentId, activityId, itemId] } },
    });

    expect(
      entries.map((entry) => [entry.recordType, entry.action, entry.actorId]),
    ).toEqual(
      expect.arrayContaining([
        ['Equipment', 'Registered', actorId],
        ['MaintenanceActivity', 'Registered', actorId],
        ['PmPlanItem', 'Registered', actorId],
      ]),
    );
  });

  it('records an execution, its due date read back as the same calendar date', async () => {
    const equipmentId = await registeredEquipment();
    const activityId = await registeredActivity();
    const itemId = await planItemOf(equipmentId, activityId, 7, '2026-07-01');

    const { dueDate } = await execute<{ dueDate: string }>(
      new RecordMaintenanceExecutionCommand(
        Identity.fromString(equipmentId),
        Identity.fromString(itemId),
        Identity.fromString(actorId),
        'انجام شد',
      ),
    );

    const [stored] = await executionRepository.forPlanItem(
      Identity.fromString(itemId),
    );
    expect(stored.dueDate().asString()).toBe(dueDate);
    expect(stored.notes()).toBe('انجام شد');
    expect(stored.performedByName()).toBe(`مسلمی ${actorId}`);
  });

  it('refuses a second execution of one occurrence, as PmOccurrenceAlreadyRecorded', async () => {
    const equipmentId = await registeredEquipment();
    const activityId = await registeredActivity();
    const itemId = await planItemOf(equipmentId, activityId, 7, '2026-07-01');
    const equipment = await equipmentRepository.get(
      Identity.fromString(equipmentId),
    );
    const activity = await activityRepository.get(
      Identity.fromString(activityId),
    );
    // Two recordings that each read "no execution yet" before either saved.
    const record = (): MaintenanceExecution =>
      equipment.recordExecutionOf(
        Identity.fromString(itemId),
        activity.name(),
        [],
        new Date('2026-07-01T05:30:00.000Z'),
        { id: Identity.fromString(actorId), name: 'مسلمی' },
        null,
      );
    await executionRepository.save(record());

    await expect(executionRepository.save(record())).rejects.toBeInstanceOf(
      PmOccurrenceAlreadyRecorded,
    );
  });

  describe('the PM schedule’s execution reads', () => {
    const july = CalendarDateRange.between(
      CalendarDate.fromString('2026-07-11'),
      CalendarDate.fromString('2026-07-31'),
    );

    // Saves an execution of `planItemId` for `dueDate`, performed at the
    // instant given, by `performer` — straight through the repository.
    async function savedExecution(
      equipmentId: string,
      planItemId: Identity,
      dueDate: string,
      performedAt: string,
      performer?: { id: Identity; name: string },
    ): Promise<string> {
      const by = performer ?? {
        id: Identity.fromString(actorId),
        name: 'مسلمی',
      };
      const execution = MaintenanceExecution.record({
        equipmentId: Identity.fromString(equipmentId),
        equipmentName: 'اکسترودر',
        planItemId,
        activityId: Identity.new(),
        activityName: 'تعویض روغن',
        dueDate: CalendarDate.fromString(dueDate),
        performedAt: new Date(performedAt),
        performedById: by.id,
        performedByName: by.name,
        notes: null,
      });
      await runAs(actorId, () => executionRepository.save(execution));
      return execution.id.asString();
    }

    it('reads the executions of the given plan items due in the range, both bounds included', async () => {
      const equipmentId = await registeredEquipment();
      const item = Identity.new();
      const other = Identity.new();
      const onFirstDay = await savedExecution(
        equipmentId,
        item,
        '2026-07-11',
        '2026-07-11T05:30:00.000Z',
      );
      const onLastDay = await savedExecution(
        equipmentId,
        item,
        '2026-07-31',
        '2026-07-31T05:30:00.000Z',
      );
      await savedExecution(
        equipmentId,
        item,
        '2026-07-10',
        '2026-07-12T05:30:00.000Z',
      );
      await savedExecution(
        equipmentId,
        item,
        '2026-08-01',
        '2026-07-30T05:30:00.000Z',
      );
      await savedExecution(
        equipmentId,
        other,
        '2026-07-15',
        '2026-07-15T05:30:00.000Z',
      );

      const read = await executionRepository.dueIn([item], july);

      expect(idsOf(read)).toEqual([onFirstDay, onLastDay].toSorted(byText));
    });

    it('reads, for the calendar, those due in the range or performed on a Tehran day in it', async () => {
      const equipmentId = await registeredEquipment();
      const item = Identity.new();
      const dueInside = await savedExecution(
        equipmentId,
        item,
        '2026-07-20',
        '2026-07-20T05:30:00.000Z',
      );
      // 20:45 UTC on 07/10 is 00:15 on 07/11 in Tehran: inside.
      const doneJustInside = await savedExecution(
        equipmentId,
        item,
        '2026-07-01',
        '2026-07-10T20:45:00.000Z',
      );
      // 20:15 UTC on 07/10 is still 07/10 in Tehran: outside.
      await savedExecution(
        equipmentId,
        item,
        '2026-07-04',
        '2026-07-10T20:15:00.000Z',
      );
      // 20:15 UTC on 07/31 is 23:45 on 07/31 in Tehran: inside.
      const doneOnLastEvening = await savedExecution(
        equipmentId,
        item,
        '2026-07-07',
        '2026-07-31T20:15:00.000Z',
      );
      // 20:45 UTC on 07/31 is already 08/01 in Tehran: outside.
      await savedExecution(
        equipmentId,
        item,
        '2026-07-08',
        '2026-07-31T20:45:00.000Z',
      );

      const read = await executionRepository.dueOrPerformedIn([item], july);

      expect(idsOf(read)).toEqual(
        [dueInside, doneJustInside, doneOnLastEvening].toSorted(byText),
      );
    });

    it('reads, for the dashboard, each plan item’s executions due in its own range, both bounds included', async () => {
      const equipmentId = await registeredEquipment();
      const weekly = Identity.new();
      const monthly = Identity.new();
      const weeklyFirst = await savedExecution(
        equipmentId,
        weekly,
        '2026-07-04',
        '2026-07-04T05:30:00.000Z',
      );
      const weeklyLast = await savedExecution(
        equipmentId,
        weekly,
        '2026-07-31',
        '2026-07-31T05:30:00.000Z',
      );
      await savedExecution(
        equipmentId,
        weekly,
        '2026-06-27',
        '2026-06-27T05:30:00.000Z',
      );
      // Inside the weekly item's range, outside the monthly one's.
      await savedExecution(
        equipmentId,
        monthly,
        '2026-07-04',
        '2026-07-04T05:30:00.000Z',
      );
      const monthlyFirst = await savedExecution(
        equipmentId,
        monthly,
        '2026-07-11',
        '2026-07-11T05:30:00.000Z',
      );

      const read = await executionRepository.dueWithinOwnRanges([
        {
          planItemId: weekly,
          range: CalendarDateRange.between(
            CalendarDate.fromString('2026-07-04'),
            july.to,
          ),
        },
        { planItemId: monthly, range: july },
      ]);

      expect(idsOf(read)).toEqual(
        [weeklyFirst, weeklyLast, monthlyFirst].toSorted(byText),
      );
    });

    it('reads nothing for no plan items', async () => {
      expect(await executionRepository.dueIn([], july)).toEqual([]);
      expect(await executionRepository.dueOrPerformedIn([], july)).toEqual([]);
      expect(await executionRepository.dueWithinOwnRanges([])).toEqual([]);
    });

    it('names each performer once, as in their latest execution', async () => {
      const equipmentId = await registeredEquipment();
      const item = Identity.new();
      const moslemi = Identity.new();
      const rezazadeh = Identity.new();
      await savedExecution(
        equipmentId,
        item,
        '2026-07-01',
        '2026-07-01T05:30:00.000Z',
        {
          id: moslemi,
          name: 'مسلمی',
        },
      );
      await savedExecution(
        equipmentId,
        item,
        '2026-07-08',
        '2026-07-08T05:30:00.000Z',
        {
          id: moslemi,
          name: 'محمد مسلمی',
        },
      );
      await savedExecution(
        equipmentId,
        item,
        '2026-07-15',
        '2026-07-15T05:30:00.000Z',
        {
          id: rezazadeh,
          name: 'رضازاده',
        },
      );

      // Other cases' rows may share the table; only ours are judged.
      const performers = await executionRepository.performers();
      const ours = performers
        .filter(
          (performer) =>
            performer.id.equals(moslemi) || performer.id.equals(rezazadeh),
        )
        .map((performer) => [performer.id.asString(), performer.name]);

      expect(ours).toHaveLength(2);
      expect(ours).toEqual(
        expect.arrayContaining([
          [moslemi.asString(), 'محمد مسلمی'],
          [rezazadeh.asString(), 'رضازاده'],
        ]),
      );
    });
  });

  it('refuses a second active item for one activity, as ActivityAlreadyInPmPlan, until the first is deactivated', async () => {
    const equipmentId = await registeredEquipment();
    const activityId = await registeredActivity();
    const activity = await activityRepository.get(
      Identity.fromString(activityId),
    );
    // Two writers that each loaded the plan before either added the item.
    const first = await loadedWithPlanItem(equipmentId, activity);
    const second = await loadedWithPlanItem(equipmentId, activity);
    await equipmentRepository.save(first);

    await expect(equipmentRepository.save(second)).rejects.toBeInstanceOf(
      ActivityAlreadyInPmPlan,
    );

    const [item] = first.activePlanItems();
    first.deactivatePlanItem(item.id, new Date('2026-07-05T05:30:00.000Z'));
    await equipmentRepository.save(first);
    await expect(
      planItemOf(equipmentId, activityId, 7, '2026-08-01'),
    ).resolves.toEqual(expect.any(String));
  });

  it('keeps two inactive items of one activity beside its one active item, with an audit entry per deactivation', async () => {
    const equipmentId = await registeredEquipment();
    const activityId = await registeredActivity();
    const deactivate = (itemId: string) =>
      execute(
        new DeactivatePmPlanItemCommand(
          Identity.fromString(equipmentId),
          Identity.fromString(itemId),
        ),
      );
    const first = await planItemOf(equipmentId, activityId, 30, '2026-07-01');
    await deactivate(first);
    const second = await planItemOf(equipmentId, activityId, 15, '2026-08-01');
    await deactivate(second);
    const third = await planItemOf(equipmentId, activityId, 7, '2026-09-01');

    const equipment = await equipmentRepository.get(
      Identity.fromString(equipmentId),
    );
    const deactivations = await prisma.auditLogEntry.findMany({
      where: { recordId: { in: [first, second] }, action: 'Deactivated' },
    });

    expect(
      equipment.activePlanItems().map((item) => item.id.asString()),
    ).toEqual([third]);
    expect(
      equipment.inactivePlanItems().map((item) => item.id.asString()),
    ).toEqual([first, second]);
    expect(
      deactivations.map((entry) => entry.recordId).toSorted(byText),
    ).toEqual([first, second].toSorted(byText));
  });

  it('refuses a plan item added over a concurrent add of another activity, as EquipmentChangedConcurrently', async () => {
    const equipmentId = await registeredEquipment();
    const oilChange = await activityRepository.get(
      Identity.fromString(await registeredActivity()),
    );
    const greasing = await activityRepository.get(
      Identity.fromString(await registeredActivity()),
    );
    // Two writers that each loaded the plan before either added its item:
    // both number theirs as the plan's first.
    const first = await loadedWithPlanItem(equipmentId, oilChange);
    const second = await loadedWithPlanItem(equipmentId, greasing);
    await equipmentRepository.save(first);

    await expect(equipmentRepository.save(second)).rejects.toBeInstanceOf(
      EquipmentChangedConcurrently,
    );
  });

  it('refuses a taken equipment name at the database, as EquipmentNameTaken', async () => {
    const name = `تجهیز ${randomUUID()}`;
    const first = Equipment.register(EquipmentName.fromString(name));
    const second = Equipment.register(EquipmentName.fromString(name));
    equipmentIds.push(first.id.asString(), second.id.asString());
    await equipmentRepository.save(first);

    await expect(equipmentRepository.save(second)).rejects.toBeInstanceOf(
      EquipmentNameTaken,
    );
  });
});
