import { EquipmentController } from '@maintenance/infrastructure/http/controllers/equipment/equipment.controller';
import { MaintenanceActivityController } from '@maintenance/infrastructure/http/controllers/maintenance-activity/maintenance-activity.controller';
import { PmDashboardController } from '@maintenance/infrastructure/http/controllers/pm-dashboard/pm-dashboard.controller';
import { PmPlanItemController } from '@maintenance/infrastructure/http/controllers/pm-plan-item/pm-plan-item.controller';
import { PmScheduleController } from '@maintenance/infrastructure/http/controllers/pm-schedule/pm-schedule.controller';

// Swagger emits routes in registration order: the register, the catalog,
// the plans, the schedule, then the dashboard over all of it.
export const Controllers = [
  EquipmentController,
  MaintenanceActivityController,
  PmPlanItemController,
  PmScheduleController,
  PmDashboardController,
];
