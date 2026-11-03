import { EntityNotFound, Identity } from '@framework/domain';
import { FixedClock } from '@maintenance/application/support/fixed-clock';
import { InMemoryEquipmentRepository } from '@maintenance/application/support/in-memory-equipment-repository';
import { Equipment } from '@maintenance/domain/equipment.aggregate';
import { PmPlanItemDeactivated } from '@maintenance/domain/events/pm-plan-item-deactivated.event';
import { EquipmentIsRetired } from '@maintenance/domain/exceptions/equipment-is-retired.exception';
import { PmPlanItemIsDeactivated } from '@maintenance/domain/exceptions/pm-plan-item-is-deactivated.exception';
import { MaintenanceActivity } from '@maintenance/domain/maintenance-activity.aggregate';
import { ActivitySpecialty } from '@maintenance/domain/value/activity-specialty.vo';
import { CalendarDate } from '@maintenance/domain/value/calendar-date.vo';
import { EquipmentName } from '@maintenance/domain/value/equipment-name.vo';
import { IntervalDays } from '@maintenance/domain/value/interval-days.vo';
import { MaintenanceActivityName } from '@maintenance/domain/value/maintenance-activity-name.vo';

import { DeactivatePmPlanItemCommand } from './deactivate-pm-plan-item.command';
import { DeactivatePmPlanItemHandler } from './deactivate-pm-plan-item.handler';

const NOW = new Date('2026-07-10T06:00:00.000Z');

function makeSut() {
  const equipmentRepository = new InMemoryEquipmentRepository();
  const sut = new DeactivatePmPlanItemHandler(
    equipmentRepository,
    new FixedClock(NOW),
  );
  const extruder = Equipment.register(EquipmentName.fromString('اکسترودر'));
  const item = extruder.addPlanItem(
    MaintenanceActivity.register(
      MaintenanceActivityName.fromString('تعویض روغن'),
      ActivitySpecialty.mechanical(),
    ),
    IntervalDays.of(30),
    CalendarDate.fromString('2026-07-01'),
  );
  equipmentRepository.seed(extruder);
  return { sut, equipmentRepository, extruder, item };
}

describe('DeactivatePmPlanItemHandler', () => {
  it('deactivates the item in the plan now, keeping it', async () => {
    const { sut, equipmentRepository, extruder, item } = makeSut();

    await sut.execute(new DeactivatePmPlanItemCommand(extruder.id, item.id));

    const saved = await equipmentRepository.get(extruder.id);
    expect(saved.activePlanItems()).toEqual([]);
    expect(saved.inactivePlanItems()).toHaveLength(1);
    expect(saved.inactivePlanItems()[0].deactivatedAt()).toEqual(NOW);
    expect(equipmentRepository.savedEvents).toEqual([
      new PmPlanItemDeactivated(
        extruder.id.asString(),
        'اکسترودر',
        item.id.asString(),
        'تعویض روغن',
      ),
    ]);
  });

  it('refuses an item already deactivated', async () => {
    const { sut, extruder, item } = makeSut();
    await sut.execute(new DeactivatePmPlanItemCommand(extruder.id, item.id));

    await expect(
      sut.execute(new DeactivatePmPlanItemCommand(extruder.id, item.id)),
    ).rejects.toBeInstanceOf(PmPlanItemIsDeactivated);
  });

  it('refuses an item of retired equipment', async () => {
    const { sut, extruder, item } = makeSut();
    extruder.retire(NOW);

    await expect(
      sut.execute(new DeactivatePmPlanItemCommand(extruder.id, item.id)),
    ).rejects.toBeInstanceOf(EquipmentIsRetired);
  });

  it('refuses an item not in the plan', async () => {
    const { sut, extruder } = makeSut();

    await expect(
      sut.execute(new DeactivatePmPlanItemCommand(extruder.id, Identity.new())),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });
});
