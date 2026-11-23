import { AddPmPlanItemHandler } from '@maintenance/application/commands/add-pm-plan-item/add-pm-plan-item.handler';
import { AssignQcActivityHandler } from '@maintenance/application/commands/assign-qc-activity/assign-qc-activity.handler';
import { ChangePmPlanItemIntervalHandler } from '@maintenance/application/commands/change-pm-plan-item-interval/change-pm-plan-item-interval.handler';
import { CompleteMissingSpecialtiesHandler } from '@maintenance/application/commands/complete-missing-specialties/complete-missing-specialties.handler';
import { DeactivatePmPlanItemHandler } from '@maintenance/application/commands/deactivate-pm-plan-item/deactivate-pm-plan-item.handler';
import { DefineQcActivityHandler } from '@maintenance/application/commands/define-qc-activity/define-qc-activity.handler';
import { DeleteEquipmentHandler } from '@maintenance/application/commands/delete-equipment/delete-equipment.handler';
import { DeleteMaintenanceExecutionHandler } from '@maintenance/application/commands/delete-maintenance-execution/delete-maintenance-execution.handler';
import { DeleteMaintenanceExecutionsHandler } from '@maintenance/application/commands/delete-maintenance-executions/delete-maintenance-executions.handler';
import { DeletePmPlanItemHandler } from '@maintenance/application/commands/delete-pm-plan-item/delete-pm-plan-item.handler';
import { DeleteQcActivityHandler } from '@maintenance/application/commands/delete-qc-activity/delete-qc-activity.handler';
import { DeleteQcExecutionHandler } from '@maintenance/application/commands/delete-qc-execution/delete-qc-execution.handler';
import { EditMaintenanceActivityHandler } from '@maintenance/application/commands/edit-maintenance-activity/edit-maintenance-activity.handler';
import { ImportPmPlansHandler } from '@maintenance/application/commands/import-pm-plans/import-pm-plans.handler';
import { ReactivateEquipmentHandler } from '@maintenance/application/commands/reactivate-equipment/reactivate-equipment.handler';
import { RecordMaintenanceExecutionHandler } from '@maintenance/application/commands/record-maintenance-execution/record-maintenance-execution.handler';
import { RecordQcExecutionHandler } from '@maintenance/application/commands/record-qc-execution/record-qc-execution.handler';
import { RecordQcExecutionsHandler } from '@maintenance/application/commands/record-qc-executions/record-qc-executions.handler';
import { RegisterEquipmentHandler } from '@maintenance/application/commands/register-equipment/register-equipment.handler';
import { RegisterMaintenanceActivityHandler } from '@maintenance/application/commands/register-maintenance-activity/register-maintenance-activity.handler';
import { RenameEquipmentHandler } from '@maintenance/application/commands/rename-equipment/rename-equipment.handler';
import { RenameQcActivityHandler } from '@maintenance/application/commands/rename-qc-activity/rename-qc-activity.handler';
import { RetireEquipmentHandler } from '@maintenance/application/commands/retire-equipment/retire-equipment.handler';
import { UnassignQcActivityHandler } from '@maintenance/application/commands/unassign-qc-activity/unassign-qc-activity.handler';

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
  // bulk import from Excel (issue #127)
  ImportPmPlansHandler,
  // executions
  RecordMaintenanceExecutionHandler,
  DeleteMaintenanceExecutionHandler,
  DeleteMaintenanceExecutionsHandler,
  // production QC (issue #119)
  DefineQcActivityHandler,
  RenameQcActivityHandler,
  DeleteQcActivityHandler,
  AssignQcActivityHandler,
  UnassignQcActivityHandler,
  RecordQcExecutionHandler,
  // several activities in one submission (issue #132)
  RecordQcExecutionsHandler,
  DeleteQcExecutionHandler,
];
