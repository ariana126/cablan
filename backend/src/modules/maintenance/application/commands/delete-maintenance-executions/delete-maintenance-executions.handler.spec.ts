import { ImmediateUnitOfWork } from '@framework/application/support/immediate-unit-of-work';
import { EntityNotFound, Identity } from '@framework/domain';
import { tehranMorningOf } from '@maintenance/application/support/fixed-clock';
import { MaintenanceWorld } from '@maintenance/application/support/maintenance-world';
import { MaintenanceExecutionDeleted } from '@maintenance/domain/events/maintenance-execution-deleted.event';

import { DeleteMaintenanceExecutionsCommand } from './delete-maintenance-executions.command';
import { DeleteMaintenanceExecutionsHandler } from './delete-maintenance-executions.handler';

/** «اکسترودر 1» oil change done 07/01 and 07/08, greasing done 07/01; «اکسترودر 2» oil change done 07/01. */
function makeSut() {
  const world = new MaintenanceWorld('2026-07-10');
  const sut = new DeleteMaintenanceExecutionsHandler(
    world.equipmentRepository,
    world.executionRepository,
    new ImmediateUnitOfWork(),
  );
  const oil = world.activity('تعویض روغن');
  const first = world.equipment('اکسترودر 1');
  const second = world.equipment('اکسترودر 2');
  const oilChange = world.planItem(first, oil, 7, '2026-07-01');
  const greasing = world.planItem(
    first,
    world.activity('گریس کاری'),
    7,
    '2026-07-01',
  );
  const secondOil = world.planItem(second, oil, 7, '2026-07-01');
  const oilFirst = world.executed(
    first,
    oilChange,
    '2026-07-01',
    tehranMorningOf('2026-07-01'),
  );
  const oilSecond = world.executed(
    first,
    oilChange,
    '2026-07-08',
    tehranMorningOf('2026-07-08'),
  );
  const greasingFirst = world.executed(
    first,
    greasing,
    '2026-07-01',
    tehranMorningOf('2026-07-01'),
  );
  const otherEquipment = world.executed(
    second,
    secondOil,
    '2026-07-01',
    tehranMorningOf('2026-07-01'),
  );
  return {
    world,
    sut,
    first,
    oilChange,
    greasing,
    oilFirst,
    oilSecond,
    greasingFirst,
    otherEquipment,
  };
}

describe('DeleteMaintenanceExecutionsHandler', () => {
  it('deletes every execution of one row, one record each, leaving other rows and equipment alone', async () => {
    const {
      world,
      sut,
      first,
      oilChange,
      oilFirst,
      oilSecond,
      greasingFirst,
      otherEquipment,
    } = makeSut();

    await sut.execute(
      new DeleteMaintenanceExecutionsCommand(first.id, oilChange.id),
    );

    expect(world.executionRepository.all()).toEqual([
      greasingFirst,
      otherEquipment,
    ]);
    expect(
      world.executionRepository.savedEvents.map(
        (event) => (event as MaintenanceExecutionDeleted).executionId,
      ),
    ).toEqual([oilFirst.id.asString(), oilSecond.id.asString()]);
  });

  it('does nothing for a row with no execution', async () => {
    const { world, sut, first, greasing } = makeSut();
    await sut.execute(
      new DeleteMaintenanceExecutionsCommand(first.id, greasing.id),
    );
    world.executionRepository.savedEvents.length = 0;

    await sut.execute(
      new DeleteMaintenanceExecutionsCommand(first.id, greasing.id),
    );

    expect(world.executionRepository.savedEvents).toEqual([]);
  });

  it('refuses unknown equipment and a row outside its plan', async () => {
    const { sut, first, oilChange } = makeSut();

    await expect(
      sut.execute(
        new DeleteMaintenanceExecutionsCommand(Identity.new(), oilChange.id),
      ),
    ).rejects.toBeInstanceOf(EntityNotFound);
    await expect(
      sut.execute(
        new DeleteMaintenanceExecutionsCommand(first.id, Identity.new()),
      ),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });
});
