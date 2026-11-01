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
import { InactivePmPlanItemReadModel } from './inactive-pm-plan-item.read-model';
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
    const deactivated = world.planItem(extruder, inspection, 10, '2026-07-01');
    extruder.deactivatePlanItem(deactivated.id, world.clock.now());
    // Done early, on 07/05, for the first due date 07/08.
    world.executed(extruder, oilChangeItem, '2026-07-08', world.clock.now());

    expect(await sut.execute(new GetEquipmentQuery(extruder.id))).toEqual(
      new EquipmentDetailReadModel(
        extruder.id.asString(),
        'اکسترودر',
        false,
        [
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
        ],
        [
          new InactivePmPlanItemReadModel(
            deactivated.id.asString(),
            inspection.id.asString(),
            'بازدید',
            10,
            '2026-07-01',
            world.clock.now().toISOString(),
          ),
        ],
      ),
    );
  });

  it('lists the inactive items with their last interval, first due date and when they were deactivated, earliest first', async () => {
    const { world, sut } = makeSut('2026-07-20');
    const extruder = world.equipment('اکسترودر');
    const oilChange = world.activity('تعویض روغن');
    const greasing = world.activity('گریس کاری');
    const inspection = world.activity('بازدید');
    const oilChangeItem = world.planItem(extruder, oilChange, 30, '2026-07-01');
    const greasingItem = world.planItem(extruder, greasing, 7, '2026-07-02');
    const inspectionItem = world.planItem(
      extruder,
      inspection,
      10,
      '2026-07-03',
    );
    extruder.changePlanItemInterval(
      oilChangeItem.id,
      IntervalDays.of(15),
      CalendarDate.fromString('2026-07-01'),
    );
    const onJuly12 = new Date('2026-07-12T08:15:00.000Z');
    const onJuly10 = new Date('2026-07-10T06:00:00.000Z');
    extruder.deactivatePlanItem(inspectionItem.id, onJuly12);
    extruder.deactivatePlanItem(oilChangeItem.id, onJuly12);
    extruder.deactivatePlanItem(greasingItem.id, onJuly10);
    oilChange.rename(MaintenanceActivityName.fromString('تعویض روغن موتور'));

    const detail = await sut.execute(new GetEquipmentQuery(extruder.id));

    expect(detail.planItems).toEqual([]);
    expect(detail.inactivePlanItems).toEqual([
      new InactivePmPlanItemReadModel(
        greasingItem.id.asString(),
        greasing.id.asString(),
        'گریس کاری',
        7,
        '2026-07-02',
        '2026-07-10T06:00:00.000Z',
      ),
      new InactivePmPlanItemReadModel(
        oilChangeItem.id.asString(),
        oilChange.id.asString(),
        'تعویض روغن موتور',
        15,
        '2026-07-01',
        '2026-07-12T08:15:00.000Z',
      ),
      new InactivePmPlanItemReadModel(
        inspectionItem.id.asString(),
        inspection.id.asString(),
        'بازدید',
        10,
        '2026-07-03',
        '2026-07-12T08:15:00.000Z',
      ),
    ]);
  });

  it('lists a re-added activity once as active and its earlier row as inactive', async () => {
    const { world, sut } = makeSut('2026-07-20');
    const extruder = world.equipment('اکسترودر');
    const oilChange = world.activity('تعویض روغن');
    const first = world.planItem(extruder, oilChange, 30, '2026-07-01');
    extruder.deactivatePlanItem(first.id, world.clock.now());
    const again = world.planItem(extruder, oilChange, 7, '2026-08-01');

    const detail = await sut.execute(new GetEquipmentQuery(extruder.id));

    expect(detail.planItems.map((item) => item.id)).toEqual([
      again.id.asString(),
    ]);
    expect(detail.inactivePlanItems.map((item) => item.id)).toEqual([
      first.id.asString(),
    ]);
  });

  it('lists the inactive items of retired equipment too', async () => {
    const { world, sut } = makeSut('2026-07-20');
    const extruder = world.equipment('اکسترودر');
    const item = world.planItem(
      extruder,
      world.activity('تعویض روغن'),
      7,
      '2026-07-01',
    );
    extruder.deactivatePlanItem(item.id, world.clock.now());
    extruder.retire(world.clock.now());

    const detail = await sut.execute(new GetEquipmentQuery(extruder.id));

    expect(detail.inactivePlanItems.map((inactive) => inactive.id)).toEqual([
      item.id.asString(),
    ]);
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

  it('shows retired equipment with its plan and next due dates, as before', async () => {
    const { world, sut } = makeSut('2026-07-10');
    const extruder = world.equipment('اکسترودر');
    world.planItem(extruder, world.activity('تعویض روغن'), 7, '2026-07-01');
    extruder.retire(world.clock.now());

    const detail = await sut.execute(new GetEquipmentQuery(extruder.id));

    expect(detail.retired).toBe(true);
    expect(detail.planItems.map((item) => item.nextDueDate)).toEqual([
      '2026-07-08',
    ]);
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
