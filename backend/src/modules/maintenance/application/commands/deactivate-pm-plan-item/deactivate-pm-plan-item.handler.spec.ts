import { EntityNotFound, Identity } from '@framework/domain';
import { FixedClock } from '@maintenance/application/support/fixed-clock';
import { InMemoryEquipmentRepository } from '@maintenance/application/support/in-memory-equipment-repository';
import { Equipment } from '@maintenance/domain/equipment.aggregate';
import { PmPlanItemRemoved } from '@maintenance/domain/events/pm-plan-item-removed.event';
import { PmPlanItemIsRemoved } from '@maintenance/domain/exceptions/pm-plan-item-is-removed.exception';
import { MaintenanceActivity } from '@maintenance/domain/maintenance-activity.aggregate';
import { CalendarDate } from '@maintenance/domain/value/calendar-date.vo';
import { EquipmentName } from '@maintenance/domain/value/equipment-name.vo';
import { IntervalDays } from '@maintenance/domain/value/interval-days.vo';
import { MaintenanceActivityName } from '@maintenance/domain/value/maintenance-activity-name.vo';

import { RemovePmPlanItemCommand } from './remove-pm-plan-item.command';
import { RemovePmPlanItemHandler } from './remove-pm-plan-item.handler';

const NOW = new Date('2026-07-10T06:00:00.000Z');

function makeSut() {
  const equipmentRepository = new InMemoryEquipmentRepository();
  const sut = new RemovePmPlanItemHandler(
    equipmentRepository,
    new FixedClock(NOW),
  );
  const extruder = Equipment.register(EquipmentName.fromString('اکسترودر'));
  const item = extruder.addPlanItem(
    MaintenanceActivity.register(
      MaintenanceActivityName.fromString('تعویض روغن'),
    ),
    IntervalDays.of(30),
    CalendarDate.fromString('2026-07-01'),
  );
  equipmentRepository.seed(extruder);
  return { sut, equipmentRepository, extruder, item };
}

describe('RemovePmPlanItemHandler', () => {
  it('removes the item from the plan now', async () => {
    const { sut, equipmentRepository, extruder, item } = makeSut();

    await sut.execute(new RemovePmPlanItemCommand(extruder.id, item.id));

    const saved = await equipmentRepository.get(extruder.id);
    expect(saved.activePlanItems()).toEqual([]);
    expect(saved.planItems()[0].removedAt()).toEqual(NOW);
    expect(equipmentRepository.savedEvents).toEqual([
      new PmPlanItemRemoved(
        extruder.id.asString(),
        'اکسترودر',
        item.id.asString(),
        'تعویض روغن',
      ),
    ]);
  });

  it('refuses an item already removed', async () => {
    const { sut, extruder, item } = makeSut();
    await sut.execute(new RemovePmPlanItemCommand(extruder.id, item.id));

    await expect(
      sut.execute(new RemovePmPlanItemCommand(extruder.id, item.id)),
    ).rejects.toBeInstanceOf(PmPlanItemIsRemoved);
  });

  it('refuses an item not in the plan', async () => {
    const { sut, extruder } = makeSut();

    await expect(
      sut.execute(new RemovePmPlanItemCommand(extruder.id, Identity.new())),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });
});
