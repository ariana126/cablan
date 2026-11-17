import { EquipmentController } from '@maintenance/infrastructure/http/controllers/equipment/equipment.controller';
import { MaintenanceActivityController } from '@maintenance/infrastructure/http/controllers/maintenance-activity/maintenance-activity.controller';
import { PmDashboardController } from '@maintenance/infrastructure/http/controllers/pm-dashboard/pm-dashboard.controller';
import { PmPlanItemController } from '@maintenance/infrastructure/http/controllers/pm-plan-item/pm-plan-item.controller';
import { PmScheduleController } from '@maintenance/infrastructure/http/controllers/pm-schedule/pm-schedule.controller';
import { QcActivityController } from '@maintenance/infrastructure/http/controllers/qc-activity/qc-activity.controller';
import { QcEquipmentController } from '@maintenance/infrastructure/http/controllers/qc-equipment/qc-equipment.controller';
import { QcExecutionController } from '@maintenance/infrastructure/http/controllers/qc-execution/qc-execution.controller';
import { QcInspectionController } from '@maintenance/infrastructure/http/controllers/qc-inspection/qc-inspection.controller';

// Swagger emits routes in registration order: the register, the catalog,
// the plans, the schedule, then the dashboard over all of it; then
// production QC (issue #119): its catalog, its equipment, the inspection
// view and the records.
export const Controllers = [
  EquipmentController,
  MaintenanceActivityController,
  PmPlanItemController,
  PmScheduleController,
  PmDashboardController,
  QcActivityController,
  QcEquipmentController,
  QcInspectionController,
  QcExecutionController,
];
