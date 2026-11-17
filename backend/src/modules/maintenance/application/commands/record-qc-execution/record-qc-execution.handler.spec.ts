import { Identity } from '@framework/domain';
import {
  EquipmentNotFound,
  QcActivityNotFound,
} from '@maintenance/application/exceptions';
import { MaintenanceWorld } from '@maintenance/application/support/maintenance-world';
import { StubDisplayNameProvider } from '@maintenance/application/support/stub-display-name-provider';
import { QcExecutionRecorded } from '@maintenance/domain/events/qc-execution-recorded.event';
import { EquipmentIsRetired } from '@maintenance/domain/exceptions/equipment-is-retired.exception';
import { QcActivityNotAssigned } from '@maintenance/domain/exceptions/qc-activity-not-assigned.exception';
import { QcTrackingNumber } from '@maintenance/domain/value/qc-tracking-number.vo';

import { RecordQcExecutionCommand } from './record-qc-execution.command';
import { RecordQcExecutionHandler } from './record-qc-execution.handler';

const inspectorId = Identity.new();
const TR_100 = QcTrackingNumber.fromString('TR-100');

function makeSut() {
  const world = new MaintenanceWorld('2026-09-23');
  const sut = new RecordQcExecutionHandler(
    world.equipmentRepository,
    world.qcActivityRepository,
    world.qcExecutionRepository,
    world.clock,
    new StubDisplayNameProvider().name(inspectorId, 'نیکروش'),
  );
  const extruder = world.equipment('اکسترودر 1');
  const dimensional = world.qcActivity('بازرسی ابعادی');
  world.qcAssigned(extruder, dimensional);
  return { world, sut, extruder, dimensional };
}

describe('RecordQcExecutionHandler', () => {
  it('records an assigned activity done now by the signed-in user, answering its id', async () => {
    const { world, sut, extruder, dimensional } = makeSut();

    const result = await sut.execute(
      new RecordQcExecutionCommand(
        extruder.id,
        dimensional.id,
        inspectorId,
        TR_100,
        'خراش جزئی روی روکش',
      ),
    );

    expect(world.qcExecutionRepository.savedEvents).toEqual([
      new QcExecutionRecorded(
        result.id,
        extruder.id.asString(),
        'اکسترودر 1',
        dimensional.id.asString(),
        'بازرسی ابعادی',
        world.clock.now(),
        'نیکروش',
        'TR-100',
        'خراش جزئی روی روکش',
      ),
    ]);
  });

  it('records without notes', async () => {
    const { world, sut, extruder, dimensional } = makeSut();

    const { id } = await sut.execute(
      new RecordQcExecutionCommand(
        extruder.id,
        dimensional.id,
        inspectorId,
        TR_100,
        undefined,
      ),
    );

    const saved = await world.qcExecutionRepository.get(
      Identity.fromString(id),
    );
    expect(saved.notes()).toBeNull();
  });

  it('records the same activity again with no gap required', async () => {
    const { world, sut, extruder, dimensional } = makeSut();
    const record = () =>
      sut.execute(
        new RecordQcExecutionCommand(
          extruder.id,
          dimensional.id,
          inspectorId,
          TR_100,
          undefined,
        ),
      );

    await record();
    await record();

    expect(world.qcExecutionRepository.all()).toHaveLength(2);
  });

  it('refuses an activity not assigned to the equipment, recording nothing', async () => {
    const { world, sut, extruder } = makeSut();
    const visual = world.qcActivity('بازرسی ظاهری');

    await expect(
      sut.execute(
        new RecordQcExecutionCommand(
          extruder.id,
          visual.id,
          inspectorId,
          TR_100,
          undefined,
        ),
      ),
    ).rejects.toBeInstanceOf(QcActivityNotAssigned);
    expect(world.qcExecutionRepository.all()).toEqual([]);
  });

  it('refuses retired equipment, recording nothing', async () => {
    const { world, sut, extruder, dimensional } = makeSut();
    extruder.retire(world.clock.now());

    await expect(
      sut.execute(
        new RecordQcExecutionCommand(
          extruder.id,
          dimensional.id,
          inspectorId,
          TR_100,
          undefined,
        ),
      ),
    ).rejects.toBeInstanceOf(EquipmentIsRetired);
    expect(world.qcExecutionRepository.all()).toEqual([]);
  });

  it('refuses unknown equipment', async () => {
    const { sut, dimensional } = makeSut();

    await expect(
      sut.execute(
        new RecordQcExecutionCommand(
          Identity.new(),
          dimensional.id,
          inspectorId,
          TR_100,
          undefined,
        ),
      ),
    ).rejects.toBeInstanceOf(EquipmentNotFound);
  });

  it('refuses an unknown QC activity', async () => {
    const { sut, extruder } = makeSut();

    await expect(
      sut.execute(
        new RecordQcExecutionCommand(
          extruder.id,
          Identity.new(),
          inspectorId,
          TR_100,
          undefined,
        ),
      ),
    ).rejects.toBeInstanceOf(QcActivityNotFound);
  });
});
