import { Clock } from '@framework/domain';
import { Equipment } from '@maintenance/domain/equipment.aggregate';
import { MaintenanceExecution } from '@maintenance/domain/maintenance-execution.aggregate';
import { PmOccurrences } from '@maintenance/domain/pm-occurrences';
import { ReadonlyPmPlanItem } from '@maintenance/domain/pm-plan-item.entity';
import { MaintenanceActivityRepository } from '@maintenance/domain/service/maintenance-activity.repository';
import { MaintenanceExecutionRepository } from '@maintenance/domain/service/maintenance-execution.repository';
import { CalendarDate } from '@maintenance/domain/value/calendar-date.vo';
import { Injectable } from '@nestjs/common';

import { byPersianName } from './persian-order';

/** One active plan item, ready for a read model. */
export interface ReadablePmPlanItem {
  readonly item: ReadonlyPmPlanItem;
  /** The activity's current name. */
  readonly activityName: string;
  readonly occurrences: PmOccurrences<MaintenanceExecution>;
}

/** A piece of equipment and its active plan items, in the order they were added. */
export interface ReadableEquipment {
  readonly equipment: Equipment;
  readonly planItems: readonly ReadablePmPlanItem[];
}

/**
 * What every PM read gathers before it can say anything: "today" (the
 * Tehran date of the clock), each active plan item's executions and its
 * activity's current name — the catalog and the executions read once per
 * query, whatever the number of equipment. The statuses themselves come
 * from the domain's `PmOccurrences`.
 */
@Injectable()
export class PmPlanReader {
  constructor(
    private readonly activityRepository: MaintenanceActivityRepository,
    private readonly executionRepository: MaintenanceExecutionRepository,
    private readonly clock: Clock,
  ) {}

  today(): CalendarDate {
    return CalendarDate.inTehranOf(this.clock.now());
  }

  /** In service only, by name. */
  inService(equipment: readonly Equipment[]): Equipment[] {
    return equipment
      .filter((candidate) => !candidate.isRetired())
      .toSorted((left, right) =>
        byPersianName(left.name().asString(), right.name().asString()),
      );
  }

  /** `equipment`, in the order given, each with its active plan items. */
  async read(equipment: readonly Equipment[]): Promise<ReadableEquipment[]> {
    if (equipment.length === 0) {
      return [];
    }
    const activityNames = await this.activityNames();
    const executionsByPlanItem = groupByPlanItem(
      await this.executionRepository.forEquipments(
        equipment.map((candidate) => candidate.id),
      ),
    );
    return equipment.map((candidate) => ({
      equipment: candidate,
      planItems: candidate.activePlanItems().map((item) => ({
        item,
        activityName:
          activityNames.get(item.activityId().asString()) ??
          item.activityName(),
        occurrences: new PmOccurrences(
          item.schedule(),
          executionsByPlanItem.get(item.id.asString()) ?? [],
        ),
      })),
    }));
  }

  private async activityNames(): Promise<Map<string, string>> {
    const activities = await this.activityRepository.list();
    return new Map(
      activities.map((activity) => [
        activity.id.asString(),
        activity.name().asString(),
      ]),
    );
  }
}

function groupByPlanItem(
  executions: readonly MaintenanceExecution[],
): Map<string, MaintenanceExecution[]> {
  const byPlanItem = new Map<string, MaintenanceExecution[]>();
  for (const execution of executions) {
    const key = execution.planItemId().asString();
    byPlanItem.set(key, [...(byPlanItem.get(key) ?? []), execution]);
  }
  return byPlanItem;
}
