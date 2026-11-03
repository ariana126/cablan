import { Clock, Identity } from '@framework/domain';
import { Equipment } from '@maintenance/domain/equipment.aggregate';
import { MaintenanceExecution } from '@maintenance/domain/maintenance-execution.aggregate';
import { PmOccurrences } from '@maintenance/domain/pm-occurrences';
import { ReadonlyPmPlanItem } from '@maintenance/domain/pm-plan-item.entity';
import { MaintenanceActivityRepository } from '@maintenance/domain/service/maintenance-activity.repository';
import { MaintenanceExecutionRepository } from '@maintenance/domain/service/maintenance-execution.repository';
import { ActivitySpecialtyValue } from '@maintenance/domain/value/activity-specialty.vo';
import { CalendarDate } from '@maintenance/domain/value/calendar-date.vo';
import { Injectable } from '@nestjs/common';

import {
  ActivityCatalog,
  CurrentActivity,
  readActivityCatalog,
} from './activity-catalog';
import { byPersianName } from './persian-order';

/** One plan item and its activity's current name and specialty. */
export interface NamedPmPlanItem<
  Item extends ReadonlyPmPlanItem = ReadonlyPmPlanItem,
> {
  readonly item: Item;
  /** The activity's current name. */
  readonly activityName: string;
  /** The activity's current specialty, or `null` while it has none. */
  readonly activitySpecialty: ActivitySpecialtyValue | null;
}

/** One plan item, ready for a read model. */
export interface ReadablePmPlanItem extends NamedPmPlanItem {
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
 * current name and specialty — the catalog and the executions read once per query,
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
      await this.catalog(),
      executions,
      () => null,
    );
  }

  /**
   * `equipment`, in the order given, each with the plan items `include`
   * keeps of every one it ever had — deactivated ones included, each ending on
   * its stop date (`Equipment.stopDateOf`). `include` sees each item's
   * activity as it is now, so a read can narrow by its specialty. Only the
   * executions `executionsOf` loads for the items kept are read, so a range
   * read loads only the history it shows.
   */
  async readWithHistory(
    equipment: readonly Equipment[],
    include: (item: ReadonlyPmPlanItem, activity: CurrentActivity) => boolean,
    executionsOf: (
      planItemIds: readonly Identity[],
    ) => Promise<MaintenanceExecution[]>,
  ): Promise<ReadableEquipment[]> {
    const catalog = await this.catalog();
    const plans = equipment.map((candidate) => ({
      equipment: candidate,
      items: candidate
        .planItems()
        .filter((item) => include(item, activityOf(item, catalog))),
    }));
    const planItemIds = plans.flatMap(({ items }) =>
      items.map((item) => item.id),
    );
    if (planItemIds.length === 0) {
      return [];
    }
    return this.readable(
      plans,
      catalog,
      await executionsOf(planItemIds),
      (candidate, item) => candidate.stopDateOf(item),
    );
  }

  /**
   * `items`, in the order given, each with its activity's current name and
   * specialty — for
   * a read that shows plan items without their occurrences (the equipment
   * detail's inactive rows).
   */
  async named<Item extends ReadonlyPmPlanItem>(
    items: readonly Item[],
  ): Promise<NamedPmPlanItem<Item>[]> {
    if (items.length === 0) {
      return [];
    }
    const catalog = await this.catalog();
    return items.map((item) => named(item, catalog));
  }

  private readable(
    plans: readonly Plan[],
    catalog: ActivityCatalog,
    executions: readonly MaintenanceExecution[],
    stopDateOf: (
      equipment: Equipment,
      item: ReadonlyPmPlanItem,
    ) => CalendarDate | null,
  ): ReadableEquipment[] {
    const executionsByPlanItem = groupByPlanItem(executions);
    return plans.map(({ equipment, items }) => ({
      equipment,
      planItems: items.map((item) => ({
        ...named(item, catalog),
        occurrences: new PmOccurrences(
          item.schedule(),
          executionsByPlanItem.get(item.id.asString()) ?? [],
          stopDateOf(equipment, item),
        ),
      })),
    }));
  }

  private catalog(): Promise<ActivityCatalog> {
    return readActivityCatalog(this.activityRepository);
  }
}

/**
 * The item's activity as the catalog has it now; the item's own snapshot of
 * the name, and no specialty, should the catalog not know it.
 */
function activityOf(
  item: ReadonlyPmPlanItem,
  catalog: ActivityCatalog,
): CurrentActivity {
  return (
    catalog.get(item.activityId().asString()) ?? {
      name: item.activityName(),
      specialty: null,
    }
  );
}

function named<Item extends ReadonlyPmPlanItem>(
  item: Item,
  catalog: ActivityCatalog,
): NamedPmPlanItem<Item> {
  const activity = activityOf(item, catalog);
  return {
    item,
    activityName: activity.name,
    activitySpecialty: activity.specialty,
  };
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
