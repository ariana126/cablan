import { Identity } from '@framework/domain';
import { Equipment } from '@maintenance/domain/equipment.aggregate';
import { MaintenanceActivity } from '@maintenance/domain/maintenance-activity.aggregate';
import { MaintenanceExecution } from '@maintenance/domain/maintenance-execution.aggregate';
import { ReadonlyPmPlanItem } from '@maintenance/domain/pm-plan-item.entity';
import { CalendarDate } from '@maintenance/domain/value/calendar-date.vo';
import { EquipmentName } from '@maintenance/domain/value/equipment-name.vo';
import { IntervalDays } from '@maintenance/domain/value/interval-days.vo';
import { MaintenanceActivityName } from '@maintenance/domain/value/maintenance-activity-name.vo';

import { FixedClock, tehranMorningOf } from './fixed-clock';
import { InMemoryEquipmentRepository } from './in-memory-equipment-repository';
import { InMemoryMaintenanceActivityRepository } from './in-memory-maintenance-activity-repository';
import { InMemoryMaintenanceExecutionRepository } from './in-memory-maintenance-execution-repository';

/**
 * The query specs' arrangement: in-memory repositories, a clock on a Tehran
 * date, and terse ways to seed equipment, activities, plan items and
 * executions.
 */
export class MaintenanceWorld {
  readonly equipmentRepository = new InMemoryEquipmentRepository();
  readonly activityRepository = new InMemoryMaintenanceActivityRepository();
  readonly executionRepository = new InMemoryMaintenanceExecutionRepository();
  readonly clock: FixedClock;

  constructor(today: string) {
    this.clock = new FixedClock(tehranMorningOf(today));
  }

  activity(name: string): MaintenanceActivity {
    return this.activityRepository.seed(
      MaintenanceActivity.register(MaintenanceActivityName.fromString(name)),
    );
  }

  equipment(name: string): Equipment {
    return this.equipmentRepository.seed(
      Equipment.register(EquipmentName.fromString(name)),
    );
  }

  planItem(
    equipment: Equipment,
    activity: MaintenanceActivity,
    intervalDays: number,
    firstDueDate: string,
  ): ReadonlyPmPlanItem {
    const item = equipment.addPlanItem(
      activity,
      IntervalDays.of(intervalDays),
      CalendarDate.fromString(firstDueDate),
    );
    equipment.releaseEvents();
    return item;
  }

  executed(
    equipment: Equipment,
    item: ReadonlyPmPlanItem,
    dueDate: string,
    performedAt: Date,
    performedByName = 'مسلمی',
    notes: string | null = null,
  ): MaintenanceExecution {
    return this.executionRepository.seed(
      MaintenanceExecution.record({
        equipmentId: equipment.id,
        equipmentName: equipment.name().asString(),
        planItemId: item.id,
        activityId: item.activityId(),
        activityName: item.activityName(),
        dueDate: CalendarDate.fromString(dueDate),
        performedAt,
        performedById: Identity.new(),
        performedByName,
        notes,
      }),
    );
  }
}
