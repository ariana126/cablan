import { ImmediateUnitOfWork } from '@framework/application/support/immediate-unit-of-work';
import { EntityNotFound, Identity } from '@framework/domain';
import { tehranMorningOf } from '@maintenance/application/support/fixed-clock';
import { MaintenanceWorld } from '@maintenance/application/support/maintenance-world';
import { PmPlanItemDeleted } from '@maintenance/domain/events/pm-plan-item-deleted.event';
import { PmPlanItemIsActive } from '@maintenance/domain/exceptions/pm-plan-item-is-active.exception';

import { DeletePmPlanItemCommand } from './delete-pm-plan-item.command';
import { DeletePmPlanItemHandler } from './delete-pm-plan-item.handler';

/**
 * «اکسترودر 1»: an oil change every 30 days from 05/01, done once and
 * deactivated; another every 15 days from 06/01, done once and deactivated;
 * and an active one every 7 days from 07/01.
 */
function makeSut() {
  const world = new MaintenanceWorld('2026-07-20');
  const sut = new DeletePmPlanItemHandler(
    world.equipmentRepository,
    world.executionRepository,
    new ImmediateUnitOfWork(),
  );
  const oilChange = world.activity('تعویض روغن');
  const extruder = world.equipment('اکسترودر 1');
  const monthly = world.planItem(extruder, oilChange, 30, '2026-05-01');
  world.executed(
    extruder,
    monthly,
    '2026-05-01',
    tehranMorningOf('2026-05-01'),
  );
  extruder.deactivatePlanItem(monthly.id, tehranMorningOf('2026-05-20'));
  const fortnightly = world.planItem(extruder, oilChange, 15, '2026-06-01');
  const keptExecution = world.executed(
    extruder,
    fortnightly,
    '2026-06-01',
    tehranMorningOf('2026-06-01'),
  );
  extruder.deactivatePlanItem(fortnightly.id, tehranMorningOf('2026-06-20'));
  const active = world.planItem(extruder, oilChange, 7, '2026-07-01');
  extruder.releaseEvents();
  return { world, sut, extruder, monthly, fortnightly, active, keptExecution };
}

describe('DeletePmPlanItemHandler', () => {
  it('deletes an inactive row with its executions, leaving the other rows alone', async () => {
    const {
      world,
      sut,
      extruder,
      monthly,
      fortnightly,
      active,
      keptExecution,
    } = makeSut();

    await sut.execute(new DeletePmPlanItemCommand(extruder.id, monthly.id));

    const saved = await world.equipmentRepository.get(extruder.id);
    expect(saved.planItems().map((item) => item.id)).toEqual([
      fortnightly.id,
      active.id,
    ]);
    expect(world.executionRepository.all()).toEqual([keptExecution]);
    expect(world.equipmentRepository.savedEvents).toEqual([
      new PmPlanItemDeleted(
        extruder.id.asString(),
        'اکسترودر 1',
        monthly.id.asString(),
        'تعویض روغن',
      ),
    ]);
  });

  it('deletes an inactive row of retired equipment', async () => {
    const { world, sut, extruder, monthly } = makeSut();
    extruder.retire(tehranMorningOf('2026-07-10'));

    await sut.execute(new DeletePmPlanItemCommand(extruder.id, monthly.id));

    const saved = await world.equipmentRepository.get(extruder.id);
    expect(saved.planItems()).toHaveLength(2);
  });

  it('refuses an active row, deleting nothing', async () => {
    const { world, sut, extruder, active } = makeSut();
    const executions = world.executionRepository.all();

    await expect(
      sut.execute(new DeletePmPlanItemCommand(extruder.id, active.id)),
    ).rejects.toBeInstanceOf(PmPlanItemIsActive);
    expect(extruder.planItems()).toHaveLength(3);
    expect(world.executionRepository.all()).toEqual(executions);
  });

  it('refuses a row outside the plan, and unknown equipment', async () => {
    const { sut, extruder, monthly } = makeSut();

    await expect(
      sut.execute(new DeletePmPlanItemCommand(extruder.id, Identity.new())),
    ).rejects.toBeInstanceOf(EntityNotFound);
    await expect(
      sut.execute(new DeletePmPlanItemCommand(Identity.new(), monthly.id)),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });
});
