import { MaintenanceWorld } from '@maintenance/application/support/maintenance-world';

import { ListQcActivitiesHandler } from './list-qc-activities.handler';
import { QcActivityReadModel } from './qc-activity.read-model';

function makeSut() {
  const world = new MaintenanceWorld('2026-09-23');
  const sut = new ListQcActivitiesHandler(world.qcAssignmentReader);
  return { world, sut };
}

describe('ListQcActivitiesHandler', () => {
  it('lists the QC catalog by Persian name, with how many pieces of equipment each is assigned to', async () => {
    const { world, sut } = makeSut();
    const visual = world.qcActivity('بازرسی ظاهری');
    const dimensional = world.qcActivity('بازرسی ابعادی');
    const packing = world.qcActivity('کنترل بسته بندی');
    const first = world.equipment('اکسترودر 1');
    const second = world.equipment('اکسترودر 2');
    world.qcAssigned(first, dimensional, visual);
    world.qcAssigned(second, dimensional);

    expect(await sut.execute()).toEqual([
      new QcActivityReadModel(dimensional.id.asString(), 'بازرسی ابعادی', 2),
      new QcActivityReadModel(visual.id.asString(), 'بازرسی ظاهری', 1),
      new QcActivityReadModel(packing.id.asString(), 'کنترل بسته بندی', 0),
    ]);
  });

  it('counts retired equipment, which keeps its assignments', async () => {
    const { world, sut } = makeSut();
    const dimensional = world.qcActivity('بازرسی ابعادی');
    const extruder = world.equipment('اکسترودر 1');
    world.qcAssigned(extruder, dimensional);
    extruder.retire(world.clock.now());

    const [listed] = await sut.execute();

    expect(listed.assignedEquipmentCount).toBe(1);
  });

  it('lists nothing while the catalog is empty', async () => {
    const { sut } = makeSut();

    expect(await sut.execute()).toEqual([]);
  });
});
