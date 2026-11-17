import { Identity } from '@framework/domain';
import {
  EquipmentNotFound,
  QcActivityNotFound,
} from '@maintenance/application/exceptions';
import { tehranMorningOf } from '@maintenance/application/support/fixed-clock';
import { MaintenanceWorld } from '@maintenance/application/support/maintenance-world';
import { QcActivityUnassigned } from '@maintenance/domain/events/qc-activity-unassigned.event';
import { QcActivityNotAssigned } from '@maintenance/domain/exceptions/qc-activity-not-assigned.exception';

import { UnassignQcActivityCommand } from './unassign-qc-activity.command';
import { UnassignQcActivityHandler } from './unassign-qc-activity.handler';

function makeSut() {
  const world = new MaintenanceWorld('2026-09-23');
  const sut = new UnassignQcActivityHandler(
    world.equipmentRepository,
    world.qcActivityRepository,
  );
  const extruder = world.equipment('اکسترودر 1');
  const dimensional = world.qcActivity('بازرسی ابعادی');
  world.qcAssigned(extruder, dimensional);
  return { world, sut, extruder, dimensional };
}

describe('UnassignQcActivityHandler', () => {
  it('unassigns a QC activity from equipment, keeping its records', async () => {
    const { world, sut, extruder, dimensional } = makeSut();
    const record = world.qcRecorded(
      extruder,
      dimensional,
      tehranMorningOf('2026-09-23'),
    );

    await sut.execute(
      new UnassignQcActivityCommand(extruder.id, dimensional.id),
    );

    const saved = await world.equipmentRepository.get(extruder.id);
    expect(saved.qcActivityIds()).toEqual([]);
    expect(world.equipmentRepository.savedEvents).toEqual([
      new QcActivityUnassigned(
        extruder.id.asString(),
        'اکسترودر 1',
        dimensional.id.asString(),
        'بازرسی ابعادی',
      ),
    ]);
    expect(world.qcExecutionRepository.all()).toEqual([record]);
  });

  it('refuses an activity not assigned to it', async () => {
    const { world, sut, extruder } = makeSut();
    const visual = world.qcActivity('بازرسی ظاهری');

    await expect(
      sut.execute(new UnassignQcActivityCommand(extruder.id, visual.id)),
    ).rejects.toBeInstanceOf(QcActivityNotAssigned);
  });

  it('refuses unknown equipment', async () => {
    const { sut, dimensional } = makeSut();

    await expect(
      sut.execute(
        new UnassignQcActivityCommand(Identity.new(), dimensional.id),
      ),
    ).rejects.toBeInstanceOf(EquipmentNotFound);
  });

  it('refuses an unknown QC activity', async () => {
    const { sut, extruder } = makeSut();

    await expect(
      sut.execute(new UnassignQcActivityCommand(extruder.id, Identity.new())),
    ).rejects.toBeInstanceOf(QcActivityNotFound);
  });
});
