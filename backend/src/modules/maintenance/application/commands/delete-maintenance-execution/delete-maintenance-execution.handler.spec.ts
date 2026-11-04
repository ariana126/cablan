import { ImmediateUnitOfWork } from '@framework/application/support/immediate-unit-of-work';
import { EntityNotFound, Identity } from '@framework/domain';
import { tehranMorningOf } from '@maintenance/application/support/fixed-clock';
import { MaintenanceWorld } from '@maintenance/application/support/maintenance-world';
import { MaintenanceExecutionDeleted } from '@maintenance/domain/events/maintenance-execution-deleted.event';

import { DeleteMaintenanceExecutionCommand } from './delete-maintenance-execution.command';
import { DeleteMaintenanceExecutionHandler } from './delete-maintenance-execution.handler';

/** «اکسترودر 1» oil change and greasing, every 7 days from 07/01, both done 07/01 and 07/08. */
function makeSut() {
  const world = new MaintenanceWorld('2026-07-10');
  const sut = new DeleteMaintenanceExecutionHandler(
    world.equipmentRepository,
    world.executionRepository,
    new ImmediateUnitOfWork(),
  );
  const extruder = world.equipment('اکسترودر 1');
  const oilChange = world.planItem(
    extruder,
    world.activity('تعویض روغن'),
    7,
    '2026-07-01',
  );
  const greasing = world.planItem(
    extruder,
    world.activity('گریس کاری'),
    7,
    '2026-07-01',
  );
  const done = (item: typeof oilChange, dueDate: string) =>
    world.executed(extruder, item, dueDate, tehranMorningOf(dueDate));
  const oilFirst = done(oilChange, '2026-07-01');
  const oilSecond = done(oilChange, '2026-07-08');
  const greasingFirst = done(greasing, '2026-07-01');
  return {
    world,
    sut,
    extruder,
    oilChange,
    greasing,
    oilFirst,
    oilSecond,
    greasingFirst,
  };
}

describe('DeleteMaintenanceExecutionHandler', () => {
  it('deletes one execution, recording what it was', async () => {
    const {
      world,
      sut,
      extruder,
      oilChange,
      oilFirst,
      oilSecond,
      greasingFirst,
    } = makeSut();

    await sut.execute(
      new DeleteMaintenanceExecutionCommand(
        extruder.id,
        oilChange.id,
        oilFirst.id,
      ),
    );

    expect(world.executionRepository.all()).toEqual([oilSecond, greasingFirst]);
    expect(world.executionRepository.savedEvents).toEqual([
      new MaintenanceExecutionDeleted(
        oilFirst.id.asString(),
        extruder.id.asString(),
        'اکسترودر 1',
        oilChange.id.asString(),
        'تعویض روغن',
        '2026-07-01',
        'مسلمی',
      ),
    ]);
  });

  it('deletes an execution of an inactive row of retired equipment', async () => {
    const { world, sut, extruder, oilChange, oilFirst } = makeSut();
    extruder.deactivatePlanItem(oilChange.id, tehranMorningOf('2026-07-09'));
    extruder.retire(tehranMorningOf('2026-07-10'));

    await sut.execute(
      new DeleteMaintenanceExecutionCommand(
        extruder.id,
        oilChange.id,
        oilFirst.id,
      ),
    );

    expect(await world.executionRepository.find(oilFirst.id)).toBeNull();
  });

  it('refuses an execution of another row, deleting nothing', async () => {
    const { world, sut, extruder, greasing, oilFirst } = makeSut();

    await expect(
      sut.execute(
        new DeleteMaintenanceExecutionCommand(
          extruder.id,
          greasing.id,
          oilFirst.id,
        ),
      ),
    ).rejects.toBeInstanceOf(EntityNotFound);
    expect(world.executionRepository.all()).toHaveLength(3);
  });

  it('refuses unknown ids', async () => {
    const { sut, extruder, oilChange, oilFirst } = makeSut();

    for (const command of [
      new DeleteMaintenanceExecutionCommand(
        Identity.new(),
        oilChange.id,
        oilFirst.id,
      ),
      new DeleteMaintenanceExecutionCommand(
        extruder.id,
        Identity.new(),
        oilFirst.id,
      ),
      new DeleteMaintenanceExecutionCommand(
        extruder.id,
        oilChange.id,
        Identity.new(),
      ),
    ]) {
      await expect(sut.execute(command)).rejects.toBeInstanceOf(EntityNotFound);
    }
  });
});
