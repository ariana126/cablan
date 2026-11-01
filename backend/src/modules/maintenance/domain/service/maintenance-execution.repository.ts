import { EntityRepository, Identity } from '@framework/domain';

import {
  MaintenanceExecution,
  Performer,
} from '../maintenance-execution.aggregate';
import { CalendarDateRange } from '../value/calendar-date-range.vo';

/**
 * The maintenance history. An implementation should also refuse a second
 * execution for one plan item's due date (a unique key), the backstop for two
 * executions recorded at once both targeting the same occurrence.
 */
export abstract class MaintenanceExecutionRepository extends EntityRepository<MaintenanceExecution> {
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
   * Everyone who performed an execution, once each, named as in their latest
   * one. In no particular order.
   */
  abstract performers(): Promise<Performer[]>;
}
