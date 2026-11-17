import { Identity } from '@framework/domain';
import { EquipmentNotFound } from '@maintenance/application/exceptions';
import { QcEquipmentStatuses } from '@maintenance/application/service/qc-equipment-statuses';
import { tehranMorningOf } from '@maintenance/application/support/fixed-clock';
import { MaintenanceWorld } from '@maintenance/application/support/maintenance-world';
import { QcActivityName } from '@maintenance/domain/value/qc-activity-name.vo';

import { GetQcEquipmentHandler } from './get-qc-equipment.handler';
import { GetQcEquipmentQuery } from './get-qc-equipment.query';

const AT_08_00 = new Date('2026-09-23T04:30:00.000Z');
const AT_10_00 = new Date('2026-09-23T06:30:00.000Z');

function makeSut() {
  const world = new MaintenanceWorld('2026-09-23');
  const sut = new GetQcEquipmentHandler(
    world.equipmentRepository,
    new QcEquipmentStatuses(
      world.qcActivityRepository,
      world.qcExecutionReader,
    ),
  );
  const extruder = world.equipment('اکسترودر 1');
  const visual = world.qcActivity('بازرسی ظاهری');
  const dimensional = world.qcActivity('بازرسی ابعادی');
  world.qcAssigned(extruder, visual, dimensional);
  return { world, sut, extruder, visual, dimensional };
}

describe('GetQcEquipmentHandler', () => {
  it('shows its assigned QC activities by Persian name, each with its last execution or none', async () => {
    const { world, sut, extruder, visual, dimensional } = makeSut();
    world.qcRecorded(extruder, dimensional, AT_10_00);
    world.qcRecorded(extruder, dimensional, AT_08_00);

    expect(await sut.execute(new GetQcEquipmentQuery(extruder.id))).toEqual({
      id: extruder.id.asString(),
      name: 'اکسترودر 1',
      retired: false,
      activities: [
        {
          activityId: dimensional.id.asString(),
          activityName: 'بازرسی ابعادی',
          lastPerformedAt: AT_10_00.toISOString(),
        },
        {
          activityId: visual.id.asString(),
          activityName: 'بازرسی ظاهری',
          lastPerformedAt: null,
        },
      ],
    });
  });

  it('counts only records of the same activity on this equipment as its last execution', async () => {
    const { world, sut, extruder, visual } = makeSut();
    const other = world.equipment('اکسترودر 2');
    world.qcAssigned(other, visual);
    world.qcRecorded(other, visual, AT_10_00);

    const folder = await sut.execute(new GetQcEquipmentQuery(extruder.id));

    expect(
      folder.activities.map((activity) => activity.lastPerformedAt),
    ).toEqual([null, null]);
  });

  // Code review: unassigned and deleted between the equipment read and the
  // catalog read, an activity is simply no longer there — not a 500.
  it('leaves out an assigned activity the catalog no longer has', async () => {
    const { world, sut, extruder, visual } = makeSut();
    await world.qcActivityRepository.delete(visual);

    const folder = await sut.execute(new GetQcEquipmentQuery(extruder.id));

    expect(folder.activities.map((activity) => activity.activityName)).toEqual([
      'بازرسی ابعادی',
    ]);
  });

  it('carries a last execution made before an unassignment into a reassignment', async () => {
    const { world, sut, extruder, dimensional } = makeSut();
    world.qcRecorded(extruder, dimensional, AT_08_00);
    extruder.unassignQcActivity(dimensional);
    extruder.assignQcActivity(dimensional);

    const folder = await sut.execute(new GetQcEquipmentQuery(extruder.id));

    expect(folder.activities[0].lastPerformedAt).toBe(AT_08_00.toISOString());
  });

  it('shows the current names', async () => {
    const { sut, extruder, dimensional } = makeSut();
    dimensional.rename(QcActivityName.fromString('بازرسی ابعاد'));

    const folder = await sut.execute(new GetQcEquipmentQuery(extruder.id));

    expect(folder.activities[0].activityName).toBe('بازرسی ابعاد');
  });

  it('shows retired equipment, flagged, with its activities', async () => {
    const { sut, extruder } = makeSut();
    extruder.retire(tehranMorningOf('2026-09-23'));

    const folder = await sut.execute(new GetQcEquipmentQuery(extruder.id));

    expect(folder.retired).toBe(true);
    expect(folder.activities).toHaveLength(2);
  });

  it('refuses unknown equipment', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(new GetQcEquipmentQuery(Identity.new())),
    ).rejects.toBeInstanceOf(EquipmentNotFound);
  });
});
