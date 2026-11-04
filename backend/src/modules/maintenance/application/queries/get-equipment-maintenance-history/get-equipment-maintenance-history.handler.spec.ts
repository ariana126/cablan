import { EntityNotFound, Identity } from '@framework/domain';
import { tehranMorningOf } from '@maintenance/application/support/fixed-clock';
import { MaintenanceWorld } from '@maintenance/application/support/maintenance-world';
import { ActivitySpecialty } from '@maintenance/domain/value/activity-specialty.vo';
import { CalendarDate } from '@maintenance/domain/value/calendar-date.vo';
import { IntervalDays } from '@maintenance/domain/value/interval-days.vo';
import { OperatingHours } from '@maintenance/domain/value/operating-hours.vo';

import { GetEquipmentMaintenanceHistoryHandler } from './get-equipment-maintenance-history.handler';
import { GetEquipmentMaintenanceHistoryQuery } from './get-equipment-maintenance-history.query';
import { MaintenanceExecutionReadModel } from './maintenance-execution.read-model';

function makeSut(today: string) {
  const world = new MaintenanceWorld(today);
  const sut = new GetEquipmentMaintenanceHistoryHandler(
    world.equipmentRepository,
    world.executionRepository,
    world.activityRepository,
  );
  return { world, sut };
}

describe('GetEquipmentMaintenanceHistoryHandler', () => {
  // Issue #110: each row names its execution and its plan row, so the
  // System Admin can delete it.
  it('lists the equipment’s executions newest first, each on time or late by its days, with its plan row', async () => {
    const { world, sut } = makeSut('2026-07-20');
    const extruder = world.equipment('اکسترودر');
    const item = world.planItem(
      extruder,
      world.activity('تعویض روغن'),
      7,
      '2026-07-01',
    );
    const first = world.executed(
      extruder,
      item,
      '2026-07-01',
      tehranMorningOf('2026-07-01'),
      'مسلمی',
      'فیلتر هم عوض شد',
    );
    const second = world.executed(
      extruder,
      item,
      '2026-07-08',
      tehranMorningOf('2026-07-10'),
      'رضازاده',
    );

    expect(
      await sut.execute(new GetEquipmentMaintenanceHistoryQuery(extruder.id)),
    ).toEqual([
      new MaintenanceExecutionReadModel(
        second.id.asString(),
        item.id.asString(),
        'تعویض روغن',
        '2026-07-08',
        tehranMorningOf('2026-07-10').toISOString(),
        'رضازاده',
        'late',
        null,
        2,
        'mechanical',
        null,
      ),
      new MaintenanceExecutionReadModel(
        first.id.asString(),
        item.id.asString(),
        'تعویض روغن',
        '2026-07-01',
        tehranMorningOf('2026-07-01').toISOString(),
        'مسلمی',
        'on_time',
        'فیلتر هم عوض شد',
        null,
        'mechanical',
        null,
      ),
    ]);
  });

  it('reports how many whole Tehran days late each execution was, null when on time', async () => {
    const { world, sut } = makeSut('2026-07-20');
    const extruder = world.equipment('اکسترودر');
    const item = world.planItem(
      extruder,
      world.activity('تعویض روغن'),
      7,
      '2026-07-01',
    );
    world.executed(extruder, item, '2026-07-01', tehranMorningOf('2026-06-29'));
    world.executed(extruder, item, '2026-07-08', tehranMorningOf('2026-07-14'));

    const rows = await sut.execute(
      new GetEquipmentMaintenanceHistoryQuery(extruder.id),
    );

    expect(rows.map((row) => [row.dueDate, row.daysLate])).toEqual([
      ['2026-07-08', 6],
      ['2026-07-01', null],
    ]);
  });

  it('keeps each execution’s status after the interval is changed', async () => {
    const { world, sut } = makeSut('2026-07-20');
    const extruder = world.equipment('اکسترودر');
    const item = world.planItem(
      extruder,
      world.activity('تعویض روغن'),
      30,
      '2026-07-01',
    );
    world.executed(extruder, item, '2026-07-01', tehranMorningOf('2026-07-03'));
    extruder.changePlanItemInterval(
      item.id,
      IntervalDays.of(15),
      CalendarDate.fromString('2026-07-01'),
    );

    const [execution] = await sut.execute(
      new GetEquipmentMaintenanceHistoryQuery(extruder.id),
    );

    expect([execution.dueDate, execution.status]).toEqual([
      '2026-07-01',
      'late',
    ]);
  });

  it('keeps the executions of a deactivated item and of retired equipment', async () => {
    const { world, sut } = makeSut('2026-07-20');
    const extruder = world.equipment('اکسترودر');
    const item = world.planItem(
      extruder,
      world.activity('تعویض روغن'),
      7,
      '2026-07-01',
    );
    world.executed(extruder, item, '2026-07-01', tehranMorningOf('2026-07-01'));
    extruder.deactivatePlanItem(item.id, world.clock.now());
    extruder.retire(world.clock.now());

    expect(
      await sut.execute(new GetEquipmentMaintenanceHistoryQuery(extruder.id)),
    ).toHaveLength(1);
  });

  it('lists only this equipment’s executions', async () => {
    const { world, sut } = makeSut('2026-07-20');
    const extruder = world.equipment('اکسترودر');
    const press = world.equipment('پرس');
    const oilChange = world.activity('تعویض روغن');
    const pressItem = world.planItem(press, oilChange, 7, '2026-07-01');
    world.executed(
      press,
      pressItem,
      '2026-07-01',
      tehranMorningOf('2026-07-01'),
    );

    expect(
      await sut.execute(new GetEquipmentMaintenanceHistoryQuery(extruder.id)),
    ).toEqual([]);
  });

  it('shows the equipment’s operating hours where they were recorded', async () => {
    const { world, sut } = makeSut('2026-07-20');
    const extruder = world.equipment('اکسترودر');
    const item = world.planItem(
      extruder,
      world.activity('تعویض روغن'),
      7,
      '2026-07-01',
    );
    const record = (dueDate: string, hours: OperatingHours | null) =>
      world.executed(
        extruder,
        item,
        dueDate,
        tehranMorningOf(dueDate),
        'مسلمی',
        null,
        Identity.new(),
        hours,
      );
    record('2026-07-01', OperatingHours.of(1250.5));
    record('2026-07-08', null);

    const rows = await sut.execute(
      new GetEquipmentMaintenanceHistoryQuery(extruder.id),
    );

    expect(rows.map((row) => [row.dueDate, row.operatingHours])).toEqual([
      ['2026-07-08', null],
      ['2026-07-01', 1250.5],
    ]);
  });

  it('shows the activity’s current specialty, even one assigned after the job was done', async () => {
    const { world, sut } = makeSut('2026-07-20');
    const extruder = world.equipment('اکسترودر');
    const oilChange = world.activityWithoutSpecialty('تعویض روغن');
    const item = world.planItem(extruder, oilChange, 7, '2026-07-01');
    world.executed(extruder, item, '2026-07-01', tehranMorningOf('2026-07-01'));

    const [before] = await sut.execute(
      new GetEquipmentMaintenanceHistoryQuery(extruder.id),
    );
    oilChange.completeMissingSpecialty(ActivitySpecialty.electrical());
    const [after] = await sut.execute(
      new GetEquipmentMaintenanceHistoryQuery(extruder.id),
    );

    expect(before.activitySpecialty).toBeNull();
    expect(after.activitySpecialty).toBe('electrical');
  });

  it('refuses unknown equipment', async () => {
    const { sut } = makeSut('2026-07-20');

    await expect(
      sut.execute(new GetEquipmentMaintenanceHistoryQuery(Identity.new())),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });
});
