import { EntityNotFound, Identity } from '@framework/domain';
import { tehranMorningOf } from '@maintenance/application/support/fixed-clock';
import { MaintenanceWorld } from '@maintenance/application/support/maintenance-world';
import { CalendarDate } from '@maintenance/domain/value/calendar-date.vo';
import { IntervalDays } from '@maintenance/domain/value/interval-days.vo';

import { GetEquipmentMaintenanceHistoryHandler } from './get-equipment-maintenance-history.handler';
import { GetEquipmentMaintenanceHistoryQuery } from './get-equipment-maintenance-history.query';
import { MaintenanceExecutionReadModel } from './maintenance-execution.read-model';

function makeSut(today: string) {
  const world = new MaintenanceWorld(today);
  const sut = new GetEquipmentMaintenanceHistoryHandler(
    world.equipmentRepository,
    world.executionRepository,
  );
  return { world, sut };
}

describe('GetEquipmentMaintenanceHistoryHandler', () => {
  it('lists the equipment’s executions newest first, each on time or late', async () => {
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
        'تعویض روغن',
        '2026-07-08',
        tehranMorningOf('2026-07-10').toISOString(),
        'رضازاده',
        'late',
        null,
      ),
      new MaintenanceExecutionReadModel(
        first.id.asString(),
        'تعویض روغن',
        '2026-07-01',
        tehranMorningOf('2026-07-01').toISOString(),
        'مسلمی',
        'on_time',
        'فیلتر هم عوض شد',
      ),
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

  it('keeps the executions of a removed item and of retired equipment', async () => {
    const { world, sut } = makeSut('2026-07-20');
    const extruder = world.equipment('اکسترودر');
    const item = world.planItem(
      extruder,
      world.activity('تعویض روغن'),
      7,
      '2026-07-01',
    );
    world.executed(extruder, item, '2026-07-01', tehranMorningOf('2026-07-01'));
    extruder.removePlanItem(item.id, world.clock.now());
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

  it('refuses unknown equipment', async () => {
    const { sut } = makeSut('2026-07-20');

    await expect(
      sut.execute(new GetEquipmentMaintenanceHistoryQuery(Identity.new())),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });
});
