import { EntityNotFound, Identity } from '@framework/domain';
import { InMemoryEquipmentRepository } from '@maintenance/application/support/in-memory-equipment-repository';
import { InMemoryMaintenanceActivityRepository } from '@maintenance/application/support/in-memory-maintenance-activity-repository';
import { Equipment } from '@maintenance/domain/equipment.aggregate';
import { PmPlanItemAdded } from '@maintenance/domain/events/pm-plan-item-added.event';
import { ActivityAlreadyInPmPlan } from '@maintenance/domain/exceptions/activity-already-in-pm-plan.exception';
import { UsageBasedIntervalNotSupported } from '@maintenance/domain/exceptions/usage-based-interval-not-supported.exception';
import { MaintenanceActivity } from '@maintenance/domain/maintenance-activity.aggregate';
import { CalendarDate } from '@maintenance/domain/value/calendar-date.vo';
import { EquipmentName } from '@maintenance/domain/value/equipment-name.vo';
import { IntervalUnit } from '@maintenance/domain/value/interval-unit';
import { MaintenanceActivityName } from '@maintenance/domain/value/maintenance-activity-name.vo';

import { AddPmPlanItemCommand } from './add-pm-plan-item.command';
import { AddPmPlanItemHandler } from './add-pm-plan-item.handler';

const FIRST_DUE = CalendarDate.fromString('2026-07-01');

function makeSut() {
  const equipmentRepository = new InMemoryEquipmentRepository();
  const activityRepository = new InMemoryMaintenanceActivityRepository();
  const sut = new AddPmPlanItemHandler(equipmentRepository, activityRepository);
  const extruder = equipmentRepository.seed(
    Equipment.register(EquipmentName.fromString('اکسترودر')),
  );
  const oilChange = activityRepository.seed(
    MaintenanceActivity.register(
      MaintenanceActivityName.fromString('تعویض روغن'),
    ),
  );
  return { sut, equipmentRepository, extruder, oilChange };
}

describe('AddPmPlanItemHandler', () => {
  it('adds an activity to the equipment’s plan with its interval and first due date', async () => {
    const { sut, equipmentRepository, extruder, oilChange } = makeSut();

    const result = await sut.execute(
      new AddPmPlanItemCommand(
        extruder.id,
        oilChange.id,
        30,
        IntervalUnit.Days,
        FIRST_DUE,
      ),
    );

    const saved = await equipmentRepository.get(extruder.id);
    const [item] = saved.activePlanItems();
    expect(result).toEqual({ id: item.id.asString() });
    expect(equipmentRepository.savedEvents).toEqual([
      new PmPlanItemAdded(
        extruder.id.asString(),
        'اکسترودر',
        item.id.asString(),
        oilChange.id.asString(),
        'تعویض روغن',
        30,
        '2026-07-01',
      ),
    ]);
  });

  it('refuses an interval in operating hours', async () => {
    const { sut, extruder, oilChange } = makeSut();

    await expect(
      sut.execute(
        new AddPmPlanItemCommand(
          extruder.id,
          oilChange.id,
          500,
          IntervalUnit.OperatingHours,
          FIRST_DUE,
        ),
      ),
    ).rejects.toBeInstanceOf(UsageBasedIntervalNotSupported);
  });

  it('refuses an activity already in the plan', async () => {
    const { sut, extruder, oilChange } = makeSut();
    const command = new AddPmPlanItemCommand(
      extruder.id,
      oilChange.id,
      30,
      IntervalUnit.Days,
      FIRST_DUE,
    );
    await sut.execute(command);

    await expect(sut.execute(command)).rejects.toBeInstanceOf(
      ActivityAlreadyInPmPlan,
    );
  });

  it('refuses an unknown activity', async () => {
    const { sut, extruder } = makeSut();

    await expect(
      sut.execute(
        new AddPmPlanItemCommand(
          extruder.id,
          Identity.new(),
          30,
          IntervalUnit.Days,
          FIRST_DUE,
        ),
      ),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });

  it('refuses unknown equipment', async () => {
    const { sut, oilChange } = makeSut();

    await expect(
      sut.execute(
        new AddPmPlanItemCommand(
          Identity.new(),
          oilChange.id,
          30,
          IntervalUnit.Days,
          FIRST_DUE,
        ),
      ),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });
});
