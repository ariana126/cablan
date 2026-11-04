import { EntityRepository, Identity } from '@framework/domain';

import {
  MaintenanceExecution,
  Performer,
} from '../maintenance-execution.aggregate';
import { CalendarDateRange } from '../value/calendar-date-range.vo';

/** One plan item and a range of its due dates. */
export interface PlanItemDueDateRange {
  readonly planItemId: Identity;
  readonly range: CalendarDateRange;
}

/**
 * The maintenance history. An implementation should also refuse a second
 * execution for one plan item's due date (a unique key), the backstop for two
 * executions recorded at once both targeting the same occurrence.
 */
export abstract class MaintenanceExecutionRepository extends EntityRepository<MaintenanceExecution> {
  /** Removes one execution, dispatching its released events (issue #110). */
  abstract delete(execution: MaintenanceExecution): Promise<void>;

  /**
   * Removes every execution of these plan items at once, recording nothing —
   * for a deleted plan row or deleted equipment, whose own event is the
   * record (issue #110).
   */
  abstract deleteOfPlanItems(planItemIds: readonly Identity[]): Promise<void>;

  /**
   * Removes every execution of one piece of equipment at once, recording
   * nothing — deleted equipment's (issue #110). By equipment, not by the
   * plan rows a caller loaded, so one recorded meanwhile is not left behind.
   */
  abstract deleteOfEquipment(equipmentId: Identity): Promise<void>;

  /** Every execution of one plan item, in no particular order. */
  abstract forPlanItem(planItemId: Identity): Promise<MaintenanceExecution[]>;

  /** Every execution of one piece of equipment's plan items, deactivated ones included, in no particular order. */
  abstract forEquipment(equipmentId: Identity): Promise<MaintenanceExecution[]>;

  /** Every execution of any of these pieces of equipment, in one read. */
  abstract forEquipments(
    equipmentIds: readonly Identity[],
  ): Promise<MaintenanceExecution[]>;

  /**
   * The executions of these plan items recorded for a due date in `range` —
   * what the PM schedule's table needs, and no more of the history.
   */
  abstract dueIn(
    planItemIds: readonly Identity[],
    range: CalendarDateRange,
  ): Promise<MaintenanceExecution[]>;

  /**
   * The executions of these plan items recorded for a due date in `range`,
   * or performed on a Tehran day in it — what the PM schedule's calendar
   * needs: a job done late sits on the day it was done.
   */
  abstract dueOrPerformedIn(
    planItemIds: readonly Identity[],
    range: CalendarDateRange,
  ): Promise<MaintenanceExecution[]>;

  /**
   * The executions of each plan item recorded for a due date within that
   * item's own range, in one read — for when plan items are read over
   * different stretches of their schedules.
   */
  abstract dueWithinOwnRanges(
    ranges: readonly PlanItemDueDateRange[],
  ): Promise<MaintenanceExecution[]>;

  /**
   * Everyone who performed an execution, once each, named as in their latest
   * one. In no particular order.
   */
  abstract performers(): Promise<Performer[]>;
}
