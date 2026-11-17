import { Identity } from '@framework/domain';
import { MaintenanceWorld } from '@maintenance/application/support/maintenance-world';

import { GetQcExecutionFilterOptionsHandler } from './get-qc-execution-filter-options.handler';

const AT_08_00 = new Date('2026-09-23T04:30:00.000Z');
const AT_10_00 = new Date('2026-09-23T06:30:00.000Z');

function makeSut() {
  const world = new MaintenanceWorld('2026-09-23');
  const sut = new GetQcExecutionFilterOptionsHandler(
    world.equipmentRepository,
    world.qcActivityRepository,
    world.qcExecutionReader,
  );
  return { world, sut };
}

describe('GetQcExecutionFilterOptionsHandler', () => {
  it('offers every piece of equipment, retired flagged, the QC catalog, and every recorder by their latest name, each by Persian name', async () => {
    const { world, sut } = makeSut();
    const press = world.equipment('پرس');
    const extruder = world.equipment('اکسترودر 1');
    const visual = world.qcActivity('بازرسی ظاهری');
    const dimensional = world.qcActivity('بازرسی ابعادی');
    world.qcAssigned(extruder, dimensional);
    const nikrooz = Identity.new();
    const mostafa = Identity.new();
    world.qcRecorded(extruder, dimensional, AT_08_00, {
      performer: { id: nikrooz, name: 'نیکروز' },
    });
    world.qcRecorded(extruder, dimensional, AT_10_00, {
      performer: { id: nikrooz, name: 'نیکروش' },
    });
    world.qcRecorded(extruder, dimensional, AT_08_00, {
      performer: { id: mostafa, name: 'مصطفی' },
    });
    press.retire(world.clock.now());

    expect(await sut.execute()).toEqual({
      equipment: [
        { id: extruder.id.asString(), name: 'اکسترودر 1', retired: false },
        { id: press.id.asString(), name: 'پرس', retired: true },
      ],
      activities: [
        { id: dimensional.id.asString(), name: 'بازرسی ابعادی' },
        { id: visual.id.asString(), name: 'بازرسی ظاهری' },
      ],
      performers: [
        { id: mostafa.asString(), name: 'مصطفی' },
        { id: nikrooz.asString(), name: 'نیکروش' },
      ],
    });
  });

  it('offers nothing when nothing is registered', async () => {
    const { sut } = makeSut();

    expect(await sut.execute()).toEqual({
      equipment: [],
      activities: [],
      performers: [],
    });
  });
});
