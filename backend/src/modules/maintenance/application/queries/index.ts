import { GetDailyPmScheduleHandler } from '@maintenance/application/queries/get-daily-pm-schedule/get-daily-pm-schedule.handler';
import { GetEquipmentHandler } from '@maintenance/application/queries/get-equipment/get-equipment.handler';
import { GetEquipmentMaintenanceHistoryHandler } from '@maintenance/application/queries/get-equipment-maintenance-history/get-equipment-maintenance-history.handler';
import { GetPmScheduleOverviewHandler } from '@maintenance/application/queries/get-pm-schedule-overview/get-pm-schedule-overview.handler';
import { ListEquipmentHandler } from '@maintenance/application/queries/list-equipment/list-equipment.handler';
import { ListMaintenanceActivitiesHandler } from '@maintenance/application/queries/list-maintenance-activities/list-maintenance-activities.handler';

export const QueryHandlers = [
  // equipment and its plan
  ListEquipmentHandler,
  GetEquipmentHandler,
  GetEquipmentMaintenanceHistoryHandler,
  // maintenance activities
  ListMaintenanceActivitiesHandler,
  // PM schedule
  GetDailyPmScheduleHandler,
  GetPmScheduleOverviewHandler,
];
