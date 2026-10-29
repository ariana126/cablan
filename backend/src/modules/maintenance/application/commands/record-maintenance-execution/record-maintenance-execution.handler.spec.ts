import { EntityNotFound, Identity } from '@framework/domain';
import {
  FixedClock,
  tehranMorningOf,
} from '@maintenance/application/support/fixed-clock';
import { InMemoryEquipmentRepository } from '@maintenance/application/support/in-memory-equipment-repository';
import { InMemoryMaintenanceActivityRepository } from '@maintenance/application/support/in-memory-maintenance-activity-repository';
import { InMemoryMaintenanceExecutionRepository } from '@maintenance/application/support/in-memory-maintenance-execution-repository';
import { StubDisplayNameProvider } from '@maintenance/application/support/stub-display-name-provider';
import { Equipment } from '@maintenance/domain/equipment.aggregate';
import { MaintenanceExecutionRecorded } from '@maintenance/domain/events/maintenance-execution-recorded.event';
import { EquipmentIsRetired } from '@maintenance/domain/exceptions/equipment-is-retired.exception';
import { PmPlanItemIsRemoved } from '@maintenance/domain/exceptions/pm-plan-item-is-removed.exception';
import { MaintenanceActivity } from '@maintenance/domain/maintenance-activity.aggregate';
import { CalendarDate } from '@maintenance/domain/value/calendar-date.vo';
import { EquipmentName } from '@maintenance/domain/value/equipment-name.vo';
import { IntervalDays } from '@maintenance/domain/value/interval-days.vo';
import { MaintenanceActivityName } from '@maintenance/domain/value/maintenance-activity-name.vo';
import { PmOccurrenceStatus } from '@maintenance/domain/value/pm-occurrence-status';

import { RecordMaintenanceExecutionCommand } from './record-maintenance-execution.command';
import { RecordMaintenanceExecutionHandler } from './record-maintenance-execution.handler';

const INSPECTOR = Identity.new();

// First due 07/01, every 7 days.
function makeSut(today: string) {
  const clock = new FixedClock(tehranMorningOf(today));
  const equipmentRepository = new InMemoryEquipmentRepository();
  const activityRepository = new InMemoryMaintenanceActivityRepository();
  const executionRepository = new InMemoryMaintenanceExecutionRepository();
  const sut = new RecordMaintenanceExecutionHandler(
    equipmentRepository,
    activityRepository,
    executionRepository,
    clock,
    new StubDisplayNameProvider().name(INSPECTOR, 'مسلمی'),
  );
  const oilChange = activityRepository.seed(
    MaintenanceActivity.register(
      MaintenanceActivityName.fromString('تعویض روغن'),
    ),
  );
  const extruder = Equipment.register(EquipmentName.fromString('اکسترودر'));
  const item = extruder.addPlanItem(
    oilChange,
    IntervalDays.of(7),
    CalendarDate.fromString('2026-07-01'),
  );
  equipmentRepository.seed(extruder);
  const record = (notes?: string) =>
    sut.execute(
      new RecordMaintenanceExecutionCommand(
        extruder.id,
        item.id,
        INSPECTOR,
        notes,
      ),
    );
  return { clock, record, executionRepository, extruder, item, oilChange };
}

describe('RecordMaintenanceExecutionHandler', () => {
  it('records the job as done now, by the signed-in user, with notes', async () => {
    const { record, executionRepository, extruder, item } =
      makeSut('2026-07-01');

    const result = await record('فیلتر هم عوض شد');

    const [execution] = executionRepository.all();
    expect(result).toEqual({
      id: execution.id.asString(),
      dueDate: '2026-07-01',
    });
    expect(executionRepository.savedEvents).toEqual([
      new MaintenanceExecutionRecorded(
        execution.id.asString(),
        extruder.id.asString(),
        'اکسترودر',
        item.id.asString(),
        'تعویض روغن',
        '2026-07-01',
        tehranMorningOf('2026-07-01'),
        'مسلمی',
        'فیلتر هم عوض شد',
      ),
    ]);
    expect(execution.performedById().equals(INSPECTOR)).toBe(true);
  });

  it('records the job without notes', async () => {
    const { record, executionRepository } = makeSut('2026-07-01');

    await record();

    expect(executionRepository.all()[0].notes()).toBeNull();
  });

  it('snapshots the activity’s current name', async () => {
    const { record, executionRepository, oilChange } = makeSut('2026-07-01');
    oilChange.rename(MaintenanceActivityName.fromString('تعویض روغن موتور'));

    await record();

    expect(executionRepository.all()[0].activityName()).toBe(
      'تعویض روغن موتور',
    );
  });

  it('is for the first due date when recorded before it, and on time', async () => {
    const { record, executionRepository } = makeSut('2026-06-29');

    const result = await record();

    expect(result.dueDate).toBe('2026-07-01');
    expect(executionRepository.all()[0].status()).toBe(
      PmOccurrenceStatus.OnTime,
    );
  });

  it('is for the overdue occurrence while the next is not reached, and late', async () => {
    const { record, executionRepository } = makeSut('2026-07-05');

    const result = await record();

    expect(result.dueDate).toBe('2026-07-01');
    expect(executionRepository.all()[0].status()).toBe(PmOccurrenceStatus.Late);
  });

  it('is for the current occurrence once the next is reached, leaving the missed one unrecorded', async () => {
    const { record } = makeSut('2026-07-08');

    const { dueDate } = await record();
    expect(dueDate).toBe('2026-07-08');
  });

  it('moves on to the next occurrence once the current one is done', async () => {
    const { record } = makeSut('2026-07-01');
    await record();

    const { dueDate } = await record();
    expect(dueDate).toBe('2026-07-08');
  });

  it('refuses a removed item', async () => {
    const { record, extruder, item } = makeSut('2026-07-01');
    extruder.removePlanItem(item.id, tehranMorningOf('2026-06-30'));

    await expect(record()).rejects.toBeInstanceOf(PmPlanItemIsRemoved);
  });

  it('refuses retired equipment', async () => {
    const { record, extruder } = makeSut('2026-07-01');
    extruder.retire(tehranMorningOf('2026-06-30'));

    await expect(record()).rejects.toBeInstanceOf(EquipmentIsRetired);
  });

  it('refuses an item not in the plan', async () => {
    const { clock, extruder } = makeSut('2026-07-01');
    const executionRepository = new InMemoryMaintenanceExecutionRepository();
    const equipmentRepository = new InMemoryEquipmentRepository();
    equipmentRepository.seed(extruder);
    const sut = new RecordMaintenanceExecutionHandler(
      equipmentRepository,
      new InMemoryMaintenanceActivityRepository(),
      executionRepository,
      clock,
      new StubDisplayNameProvider().name(INSPECTOR, 'مسلمی'),
    );

    await expect(
      sut.execute(
        new RecordMaintenanceExecutionCommand(
          extruder.id,
          Identity.new(),
          INSPECTOR,
          undefined,
        ),
      ),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });
});
