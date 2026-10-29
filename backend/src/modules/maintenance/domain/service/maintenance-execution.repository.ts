import { EntityRepository, Identity } from '@framework/domain';

import { MaintenanceExecution } from '../maintenance-execution.aggregate';

/**
 * The maintenance history. An implementation should also refuse a second
 * execution for one plan item's due date (a unique key), the backstop for two
 * executions recorded at once both targeting the same occurrence.
 */
export abstract class MaintenanceExecutionRepository extends EntityRepository<MaintenanceExecution> {
  /** Every execution of one plan item, in no particular order. */
  abstract forPlanItem(planItemId: Identity): Promise<MaintenanceExecution[]>;

  /** Every execution of one piece of equipment's plan items, removed ones included, in no particular order. */
  abstract forEquipment(equipmentId: Identity): Promise<MaintenanceExecution[]>;

  /** Every execution of any of these pieces of equipment, in one read. */
  abstract forEquipments(
    equipmentIds: readonly Identity[],
  ): Promise<MaintenanceExecution[]>;
}
