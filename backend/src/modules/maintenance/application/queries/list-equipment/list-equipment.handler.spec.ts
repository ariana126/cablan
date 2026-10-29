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
      new EquipmentReadModel(extruder.id.asString(), 'اکسترودر', false),
      new EquipmentReadModel(press.id.asString(), 'پرس', false),
      new EquipmentReadModel(mixer.id.asString(), 'میکسر', true),
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
});
