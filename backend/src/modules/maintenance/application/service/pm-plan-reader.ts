import { Clock, Identity } from '@framework/domain';
import { Equipment } from '@maintenance/domain/equipment.aggregate';
import { MaintenanceExecution } from '@maintenance/domain/maintenance-execution.aggregate';
import { PmOccurrences } from '@maintenance/domain/pm-occurrences';
import { ReadonlyPmPlanItem } from '@maintenance/domain/pm-plan-item.entity';
import { MaintenanceActivityRepository } from '@maintenance/domain/service/maintenance-activity.repository';
import { MaintenanceExecutionRepository } from '@maintenance/domain/service/maintenance-execution.repository';
import { CalendarDate } from '@maintenance/domain/value/calendar-date.vo';
import { Injectable } from '@nestjs/common';

import { byPersianName } from './persian-order';

/** One plan item, ready for a read model. */
export interface ReadablePmPlanItem {
  readonly item: ReadonlyPmPlanItem;
  /** The activity's current name. */
  readonly activityName: string;
  readonly occurrences: PmOccurrences<MaintenanceExecution>;
}

/** A piece of equipment and its plan items, in the order they were added. */
export interface ReadableEquipment {
  readonly equipment: Equipment;
  readonly planItems: readonly ReadablePmPlanItem[];
}

interface Plan {
  readonly equipment: Equipment;
  readonly items: readonly ReadonlyPmPlanItem[];
}

/**
 * What every PM read gathers before it can say anything: "today" (the
 * Tehran date of the clock), each plan item's executions and its activity's
 * current name — the catalog and the executions read once per query,
 * whatever the number of equipment. The statuses themselves come from the
 * domain's `PmOccurrences`.
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
    return this.byName(equipment.filter((candidate) => !candidate.isRetired()));
  }

  /** Retired included, by name. */
  byName(equipment: readonly Equipment[]): Equipment[] {
    return equipment.toSorted((left, right) =>
      byPersianName(left.name().asString(), right.name().asString()),
    );
  }

  /**
   * `equipment`, in the order given, each with its active plan items and
   * every execution of them — the daily list's and the equipment detail's
   * view, which judge each active item as in force (the detail shows a
   * retired equipment's next due dates too).
   */
  async read(equipment: readonly Equipment[]): Promise<ReadableEquipment[]> {
    if (equipment.length === 0) {
      return [];
    }
    const executions = await this.executionRepository.forEquipments(
      equipment.map((candidate) => candidate.id),
    );
    return this.readable(
      equipment.map((candidate) => ({
        equipment: candidate,
        items: candidate.activePlanItems(),
      })),
      executions,
      () => null,
    );
  }

  /**
   * `equipment`, in the order given, each with the plan items `include`
   * keeps of every one it ever had — removed ones included, each ending on
   * its stop date (`Equipment.stopDateOf`). Only the executions
   * `executionsOf` loads for those items are read, so a range read loads
   * only the history it shows.
   */
  async readWithHistory(
    equipment: readonly Equipment[],
    include: (item: ReadonlyPmPlanItem) => boolean,
    executionsOf: (
      planItemIds: readonly Identity[],
    ) => Promise<MaintenanceExecution[]>,
  ): Promise<ReadableEquipment[]> {
    const plans = equipment.map((candidate) => ({
      equipment: candidate,
      items: candidate.planItems().filter((item) => include(item)),
    }));
    const planItemIds = plans.flatMap(({ items }) =>
      items.map((item) => item.id),
    );
    if (planItemIds.length === 0) {
      return [];
    }
    return this.readable(
      plans,
      await executionsOf(planItemIds),
      (candidate, item) => candidate.stopDateOf(item),
    );
  }

  private async readable(
    plans: readonly Plan[],
    executions: readonly MaintenanceExecution[],
    stopDateOf: (
      equipment: Equipment,
      item: ReadonlyPmPlanItem,
    ) => CalendarDate | null,
  ): Promise<ReadableEquipment[]> {
    const activityNames = await this.activityNames();
    const executionsByPlanItem = groupByPlanItem(executions);
    return plans.map(({ equipment, items }) => ({
      equipment,
      planItems: items.map((item) => ({
        item,
        activityName:
          activityNames.get(item.activityId().asString()) ??
          item.activityName(),
        occurrences: new PmOccurrences(
          item.schedule(),
          executionsByPlanItem.get(item.id.asString()) ?? [],
          stopDateOf(equipment, item),
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
