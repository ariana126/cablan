import { MaintenanceWorld } from '@maintenance/application/support/maintenance-world';

import { EquipmentReadModel } from './equipment.read-model';
import { ListEquipmentHandler } from './list-equipment.handler';

describe('ListEquipmentHandler', () => {
  it('lists every piece of equipment by name, retired ones flagged', async () => {
    const world = new MaintenanceWorld('2026-07-10');
    const press = world.equipment('پرس');
    const extruder = world.equipment('اکسترودر');
    const mixer = world.equipment('میکسر');
    mixer.retire(world.clock.now());
    const sut = new ListEquipmentHandler(world.equipmentRepository);

    expect(await sut.execute()).toEqual([
      new EquipmentReadModel(extruder.id.asString(), 'اکسترودر', false, 0),
      new EquipmentReadModel(press.id.asString(), 'پرس', false, 0),
      new EquipmentReadModel(mixer.id.asString(), 'میکسر', true, 0),
    ]);
  });

  it('orders by the Persian alphabet, not by code point', async () => {
    // By code point «پ» (U+067E) comes after «ت» (U+062A); in the Persian
    // alphabet it comes right after «ب».
    const world = new MaintenanceWorld('2026-07-10');
    world.equipment('تراش');
    world.equipment('پرس');
    world.equipment('برش');
    const sut = new ListEquipmentHandler(world.equipmentRepository);

    const listed = await sut.execute();
    expect(listed.map((equipment) => equipment.name)).toEqual([
      'برش',
      'پرس',
      'تراش',
    ]);
  });

  describe('active plan item count', () => {
    it('is zero for equipment with no plan items', async () => {
      const world = new MaintenanceWorld('2026-07-10');
      world.equipment('پرس');
      const sut = new ListEquipmentHandler(world.equipmentRepository);

      const [press] = await sut.execute();
      expect(press.activePlanItemCount).toBe(0);
    });

    it('counts every item in the equipment’s plan', async () => {
      const world = new MaintenanceWorld('2026-07-10');
      const press = world.equipment('پرس');
      world.planItem(press, world.activity('روغن‌کاری'), 7, '2026-07-12');
      world.planItem(press, world.activity('بازرسی'), 30, '2026-07-20');
      world.planItem(press, world.activity('کالیبراسیون'), 90, '2026-08-01');
      const sut = new ListEquipmentHandler(world.equipmentRepository);

      const [listed] = await sut.execute();
      expect(listed.activePlanItemCount).toBe(3);
    });

    it('leaves out items removed from the plan', async () => {
      const world = new MaintenanceWorld('2026-07-10');
      const press = world.equipment('پرس');
      const removed = world.planItem(
        press,
        world.activity('روغن‌کاری'),
        7,
        '2026-07-12',
      );
      world.planItem(press, world.activity('بازرسی'), 30, '2026-07-20');
      press.removePlanItem(removed.id, world.clock.now());
      const sut = new ListEquipmentHandler(world.equipmentRepository);

      const [listed] = await sut.execute();
      expect(listed.activePlanItemCount).toBe(1);
    });

    it('keeps reporting the count of retired equipment', async () => {
      const world = new MaintenanceWorld('2026-07-10');
      const press = world.equipment('پرس');
      world.planItem(press, world.activity('روغن‌کاری'), 7, '2026-07-12');
      world.planItem(press, world.activity('بازرسی'), 30, '2026-07-20');
      press.retire(world.clock.now());
      const sut = new ListEquipmentHandler(world.equipmentRepository);

      const [listed] = await sut.execute();
      expect(listed.retired).toBe(true);
      expect(listed.activePlanItemCount).toBe(2);
    });
  });
});
