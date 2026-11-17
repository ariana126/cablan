import { Identity } from '@framework/domain';
import {
  EquipmentNotFound,
  QcActivityNotFound,
} from '@maintenance/application/exceptions';
import { MaintenanceWorld } from '@maintenance/application/support/maintenance-world';
import { QcActivityAssigned } from '@maintenance/domain/events/qc-activity-assigned.event';
import { EquipmentIsRetired } from '@maintenance/domain/exceptions/equipment-is-retired.exception';
import { QcActivityAlreadyAssigned } from '@maintenance/domain/exceptions/qc-activity-already-assigned.exception';

import { AssignQcActivityCommand } from './assign-qc-activity.command';
import { AssignQcActivityHandler } from './assign-qc-activity.handler';

function makeSut() {
  const world = new MaintenanceWorld('2026-09-23');
  const sut = new AssignQcActivityHandler(
    world.equipmentRepository,
    world.qcActivityRepository,
  );
  const extruder = world.equipment('اکسترودر 1');
  const dimensional = world.qcActivity('بازرسی ابعادی');
  return { world, sut, extruder, dimensional };
}

describe('AssignQcActivityHandler', () => {
  it('assigns a QC activity to equipment', async () => {
    const { world, sut, extruder, dimensional } = makeSut();

    await sut.execute(new AssignQcActivityCommand(extruder.id, dimensional.id));

    const saved = await world.equipmentRepository.get(extruder.id);
    expect(saved.qcActivityIds()).toEqual([dimensional.id]);
    expect(world.equipmentRepository.savedEvents).toEqual([
      new QcActivityAssigned(
        extruder.id.asString(),
        'اکسترودر 1',
        dimensional.id.asString(),
        'بازرسی ابعادی',
      ),
    ]);
  });

  it('refuses an activity already assigned to it', async () => {
    const { world, sut, extruder, dimensional } = makeSut();
    world.qcAssigned(extruder, dimensional);

    await expect(
      sut.execute(new AssignQcActivityCommand(extruder.id, dimensional.id)),
    ).rejects.toBeInstanceOf(QcActivityAlreadyAssigned);
  });

  it('refuses retired equipment', async () => {
    const { world, sut, extruder, dimensional } = makeSut();
    extruder.retire(world.clock.now());

    await expect(
      sut.execute(new AssignQcActivityCommand(extruder.id, dimensional.id)),
    ).rejects.toBeInstanceOf(EquipmentIsRetired);
  });

  it('refuses unknown equipment', async () => {
    const { sut, dimensional } = makeSut();

    await expect(
      sut.execute(new AssignQcActivityCommand(Identity.new(), dimensional.id)),
    ).rejects.toBeInstanceOf(EquipmentNotFound);
  });

  it('refuses an unknown QC activity', async () => {
    const { sut, extruder } = makeSut();

    await expect(
      sut.execute(new AssignQcActivityCommand(extruder.id, Identity.new())),
    ).rejects.toBeInstanceOf(QcActivityNotFound);
  });
});
