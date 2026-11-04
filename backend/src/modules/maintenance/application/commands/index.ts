import { AddPmPlanItemHandler } from '@maintenance/application/commands/add-pm-plan-item/add-pm-plan-item.handler';
import { ChangePmPlanItemIntervalHandler } from '@maintenance/application/commands/change-pm-plan-item-interval/change-pm-plan-item-interval.handler';
import { CompleteMissingSpecialtiesHandler } from '@maintenance/application/commands/complete-missing-specialties/complete-missing-specialties.handler';
import { DeactivatePmPlanItemHandler } from '@maintenance/application/commands/deactivate-pm-plan-item/deactivate-pm-plan-item.handler';
import { DeleteEquipmentHandler } from '@maintenance/application/commands/delete-equipment/delete-equipment.handler';
import { DeleteMaintenanceExecutionHandler } from '@maintenance/application/commands/delete-maintenance-execution/delete-maintenance-execution.handler';
import { DeleteMaintenanceExecutionsHandler } from '@maintenance/application/commands/delete-maintenance-executions/delete-maintenance-executions.handler';
import { DeletePmPlanItemHandler } from '@maintenance/application/commands/delete-pm-plan-item/delete-pm-plan-item.handler';
import { EditMaintenanceActivityHandler } from '@maintenance/application/commands/edit-maintenance-activity/edit-maintenance-activity.handler';
import { ReactivateEquipmentHandler } from '@maintenance/application/commands/reactivate-equipment/reactivate-equipment.handler';
import { RecordMaintenanceExecutionHandler } from '@maintenance/application/commands/record-maintenance-execution/record-maintenance-execution.handler';
import { RegisterEquipmentHandler } from '@maintenance/application/commands/register-equipment/register-equipment.handler';
import { RegisterMaintenanceActivityHandler } from '@maintenance/application/commands/register-maintenance-activity/register-maintenance-activity.handler';
import { RenameEquipmentHandler } from '@maintenance/application/commands/rename-equipment/rename-equipment.handler';
import { RetireEquipmentHandler } from '@maintenance/application/commands/retire-equipment/retire-equipment.handler';

export const CommandHandlers = [
  // equipment
  RegisterEquipmentHandler,
  RenameEquipmentHandler,
  RetireEquipmentHandler,
  ReactivateEquipmentHandler,
  DeleteEquipmentHandler,
  // maintenance activities
  RegisterMaintenanceActivityHandler,
  EditMaintenanceActivityHandler,
  CompleteMissingSpecialtiesHandler,
  // PM plans
  AddPmPlanItemHandler,
  ChangePmPlanItemIntervalHandler,
  DeactivatePmPlanItemHandler,
  DeletePmPlanItemHandler,
  // executions
  RecordMaintenanceExecutionHandler,
  DeleteMaintenanceExecutionHandler,
  DeleteMaintenanceExecutionsHandler,
];
