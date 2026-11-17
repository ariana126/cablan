import { Identity } from '@framework/domain';
import { QcExecutionNotFound } from '@maintenance/application/exceptions';
import { tehranMorningOf } from '@maintenance/application/support/fixed-clock';
import {
  MaintenanceWorld,
  NIKROOZ,
} from '@maintenance/application/support/maintenance-world';
import { QcExecutionDeleted } from '@maintenance/domain/events/qc-execution-deleted.event';
import { EquipmentName } from '@maintenance/domain/value/equipment-name.vo';

import { DeleteQcExecutionCommand } from './delete-qc-execution.command';
import { DeleteQcExecutionHandler } from './delete-qc-execution.handler';

const ON_0701 = tehranMorningOf('2026-09-23');
const ON_0702 = tehranMorningOf('2026-09-24');

function makeSut() {
  const world = new MaintenanceWorld('2026-09-24');
  const sut = new DeleteQcExecutionHandler(
    world.equipmentRepository,
    world.qcActivityRepository,
    world.qcExecutionRepository,
  );
  const extruder = world.equipment('اکسترودر 1');
  const dimensional = world.qcActivity('بازرسی ابعادی');
  world.qcAssigned(extruder, dimensional);
  const first = world.qcRecorded(extruder, dimensional, ON_0701);
  const second = world.qcRecorded(extruder, dimensional, ON_0702, {
    trackingNumber: 'TR-101',
  });
  return { world, sut, extruder, dimensional, first, second };
}

describe('DeleteQcExecutionHandler', () => {
  it('deletes one QC record and nothing else, under the current names', async () => {
    const { world, sut, extruder, dimensional, first, second } = makeSut();
    extruder.correctName(EquipmentName.fromString('اکسترودر خط یک'));

    await sut.execute(new DeleteQcExecutionCommand(second.id));

    expect(world.qcExecutionRepository.all()).toEqual([first]);
    expect(world.qcExecutionRepository.savedEvents).toEqual([
      new QcExecutionDeleted(
        second.id.asString(),
        extruder.id.asString(),
        'اکسترودر خط یک',
        dimensional.id.asString(),
        'بازرسی ابعادی',
        ON_0702,
        NIKROOZ.name,
        'TR-101',
      ),
    ]);
    expect(extruder.qcActivityIds()).toEqual([dimensional.id]);
  });

  it('refuses an unknown QC record', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(new DeleteQcExecutionCommand(Identity.new())),
    ).rejects.toBeInstanceOf(QcExecutionNotFound);
  });
});
