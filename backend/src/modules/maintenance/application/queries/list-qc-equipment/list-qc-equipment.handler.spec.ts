import { MaintenanceWorld } from '@maintenance/application/support/maintenance-world';

import { ListQcEquipmentHandler } from './list-qc-equipment.handler';
import { QcEquipmentSummaryReadModel } from './qc-equipment-summary.read-model';

describe('ListQcEquipmentHandler', () => {
  it('lists every piece of equipment by Persian name, retired flagged, with how many QC activities it has', async () => {
    const world = new MaintenanceWorld('2026-09-23');
    const sut = new ListQcEquipmentHandler(world.qcAssignmentReader);
    const press = world.equipment('پرس');
    const extruder = world.equipment('اکسترودر 1');
    const mixer = world.equipment('بالمیکسر');
    world.qcAssigned(
      extruder,
      world.qcActivity('بازرسی ابعادی'),
      world.qcActivity('بازرسی ظاهری'),
    );
    world.qcAssigned(press, world.qcActivity('کنترل بسته بندی'));
    press.retire(world.clock.now());

    expect(await sut.execute()).toEqual([
      new QcEquipmentSummaryReadModel(
        extruder.id.asString(),
        'اکسترودر 1',
        false,
        2,
      ),
      new QcEquipmentSummaryReadModel(
        mixer.id.asString(),
        'بالمیکسر',
        false,
        0,
      ),
      new QcEquipmentSummaryReadModel(press.id.asString(), 'پرس', true, 1),
    ]);
  });
});
