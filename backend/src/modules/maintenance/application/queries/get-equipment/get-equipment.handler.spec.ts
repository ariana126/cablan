import { EntityNotFound, Identity } from '@framework/domain';
import { PmPlanReader } from '@maintenance/application/service/pm-plan-reader';
import { tehranMorningOf } from '@maintenance/application/support/fixed-clock';
import { MaintenanceWorld } from '@maintenance/application/support/maintenance-world';
import { CalendarDate } from '@maintenance/domain/value/calendar-date.vo';
import { IntervalDays } from '@maintenance/domain/value/interval-days.vo';
import { MaintenanceActivityName } from '@maintenance/domain/value/maintenance-activity-name.vo';

import { EquipmentDetailReadModel } from './equipment-detail.read-model';
import { GetEquipmentHandler } from './get-equipment.handler';
import { GetEquipmentQuery } from './get-equipment.query';
import { PmPlanItemReadModel } from './pm-plan-item.read-model';

function makeSut(today: string) {
  const world = new MaintenanceWorld(today);
  const sut = new GetEquipmentHandler(
    world.equipmentRepository,
    new PmPlanReader(
      world.activityRepository,
      world.executionRepository,
      world.clock,
    ),
  );
  return { world, sut };
}

describe('GetEquipmentHandler', () => {
  it('shows the equipment with its active plan items, in the order added, and their next due dates', async () => {
    const { world, sut } = makeSut('2026-07-05');
    const extruder = world.equipment('اکسترودر');
    const oilChange = world.activity('تعویض روغن');
    const greasing = world.activity('گریس کاری');
    const inspection = world.activity('بازدید');
    const oilChangeItem = world.planItem(extruder, oilChange, 7, '2026-07-08');
    const greasingItem = world.planItem(extruder, greasing, 30, '2026-07-01');
    const removed = world.planItem(extruder, inspection, 10, '2026-07-01');
    extruder.removePlanItem(removed.id, world.clock.now());
    // Done early, on 07/05, for the first due date 07/08.
    world.executed(extruder, oilChangeItem, '2026-07-08', world.clock.now());

    expect(await sut.execute(new GetEquipmentQuery(extruder.id))).toEqual(
      new EquipmentDetailReadModel(extruder.id.asString(), 'اکسترودر', false, [
        new PmPlanItemReadModel(
          oilChangeItem.id.asString(),
          oilChange.id.asString(),
          'تعویض روغن',
          7,
          '2026-07-08',
          '2026-07-15',
        ),
        new PmPlanItemReadModel(
          greasingItem.id.asString(),
          greasing.id.asString(),
          'گریس کاری',
          30,
          '2026-07-01',
          '2026-07-01',
        ),
      ]),
    );
  });

  it('shows the next due date of a shortened interval (30 → 15 on 07/10 after due 07/01 ⇒ 07/16)', async () => {
    const { world, sut } = makeSut('2026-07-10');
    const extruder = world.equipment('اکسترودر');
    const item = world.planItem(
      extruder,
      world.activity('تعویض روغن'),
      30,
      '2026-07-01',
    );
    world.executed(extruder, item, '2026-07-01', tehranMorningOf('2026-07-01'));
    extruder.changePlanItemInterval(
      item.id,
      IntervalDays.of(15),
      CalendarDate.fromString('2026-07-01'),
    );

    const detail = await sut.execute(new GetEquipmentQuery(extruder.id));
    const [planItem] = detail.planItems;

    expect(planItem.intervalDays).toBe(15);
    expect(planItem.firstDueDate).toBe('2026-07-01');
    expect(planItem.nextDueDate).toBe('2026-07-16');
  });

  it('names each item’s activity as it is called now', async () => {
    const { world, sut } = makeSut('2026-07-10');
    const extruder = world.equipment('اکسترودر');
    const oilChange = world.activity('تعویض روغن');
    world.planItem(extruder, oilChange, 7, '2026-07-01');
    oilChange.rename(MaintenanceActivityName.fromString('تعویض روغن موتور'));

    const detail = await sut.execute(new GetEquipmentQuery(extruder.id));
    const [planItem] = detail.planItems;

    expect(planItem.activityName).toBe('تعویض روغن موتور');
  });

  it('refuses unknown equipment', async () => {
    const { sut } = makeSut('2026-07-10');

    await expect(
      sut.execute(new GetEquipmentQuery(Identity.new())),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });
});
