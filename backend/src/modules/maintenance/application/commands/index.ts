import { AddPmPlanItemHandler } from '@maintenance/application/commands/add-pm-plan-item/add-pm-plan-item.handler';
import { ChangePmPlanItemIntervalHandler } from '@maintenance/application/commands/change-pm-plan-item-interval/change-pm-plan-item-interval.handler';
import { RecordMaintenanceExecutionHandler } from '@maintenance/application/commands/record-maintenance-execution/record-maintenance-execution.handler';
import { RegisterEquipmentHandler } from '@maintenance/application/commands/register-equipment/register-equipment.handler';
import { RegisterMaintenanceActivityHandler } from '@maintenance/application/commands/register-maintenance-activity/register-maintenance-activity.handler';
import { RemovePmPlanItemHandler } from '@maintenance/application/commands/remove-pm-plan-item/remove-pm-plan-item.handler';
import { RenameEquipmentHandler } from '@maintenance/application/commands/rename-equipment/rename-equipment.handler';
import { RenameMaintenanceActivityHandler } from '@maintenance/application/commands/rename-maintenance-activity/rename-maintenance-activity.handler';
import { RetireEquipmentHandler } from '@maintenance/application/commands/retire-equipment/retire-equipment.handler';

export const CommandHandlers = [
  // equipment
  RegisterEquipmentHandler,
  RenameEquipmentHandler,
  RetireEquipmentHandler,
  // maintenance activities
  RegisterMaintenanceActivityHandler,
  RenameMaintenanceActivityHandler,
  // PM plans
  AddPmPlanItemHandler,
  ChangePmPlanItemIntervalHandler,
  RemovePmPlanItemHandler,
  // executions
  RecordMaintenanceExecutionHandler,
];
