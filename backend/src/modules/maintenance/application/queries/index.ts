import { GetDailyPmScheduleHandler } from '@maintenance/application/queries/get-daily-pm-schedule/get-daily-pm-schedule.handler';
import { GetEquipmentHandler } from '@maintenance/application/queries/get-equipment/get-equipment.handler';
import { GetEquipmentMaintenanceHistoryHandler } from '@maintenance/application/queries/get-equipment-maintenance-history/get-equipment-maintenance-history.handler';
import { GetPmDashboardHandler } from '@maintenance/application/queries/get-pm-dashboard/get-pm-dashboard.handler';
import { GetPmScheduleCalendarHandler } from '@maintenance/application/queries/get-pm-schedule-calendar/get-pm-schedule-calendar.handler';
import { GetPmScheduleFilterOptionsHandler } from '@maintenance/application/queries/get-pm-schedule-filter-options/get-pm-schedule-filter-options.handler';
import { GetPmScheduleOverviewHandler } from '@maintenance/application/queries/get-pm-schedule-overview/get-pm-schedule-overview.handler';
import { GetQcEquipmentHandler } from '@maintenance/application/queries/get-qc-equipment/get-qc-equipment.handler';
import { GetQcExecutionFilterOptionsHandler } from '@maintenance/application/queries/get-qc-execution-filter-options/get-qc-execution-filter-options.handler';
import { GetQcExecutionHistoryHandler } from '@maintenance/application/queries/get-qc-execution-history/get-qc-execution-history.handler';
import { ListActivitiesWithoutSpecialtyHandler } from '@maintenance/application/queries/list-activities-without-specialty/list-activities-without-specialty.handler';
import { ListEquipmentHandler } from '@maintenance/application/queries/list-equipment/list-equipment.handler';
import { ListMaintenanceActivitiesHandler } from '@maintenance/application/queries/list-maintenance-activities/list-maintenance-activities.handler';
import { ListQcActivitiesHandler } from '@maintenance/application/queries/list-qc-activities/list-qc-activities.handler';
import { ListQcEquipmentHandler } from '@maintenance/application/queries/list-qc-equipment/list-qc-equipment.handler';
import { ListQcInspectionsHandler } from '@maintenance/application/queries/list-qc-inspections/list-qc-inspections.handler';

export const QueryHandlers = [
  // equipment and its plan
  ListEquipmentHandler,
  GetEquipmentHandler,
  GetEquipmentMaintenanceHistoryHandler,
  // maintenance activities
  ListMaintenanceActivitiesHandler,
  ListActivitiesWithoutSpecialtyHandler,
  // PM schedule
  GetDailyPmScheduleHandler,
  GetPmScheduleOverviewHandler,
  GetPmScheduleCalendarHandler,
  GetPmScheduleFilterOptionsHandler,
  // the technical management dashboard
  GetPmDashboardHandler,
  // production QC (issue #119)
  ListQcActivitiesHandler,
  ListQcEquipmentHandler,
  GetQcEquipmentHandler,
  ListQcInspectionsHandler,
  GetQcExecutionHistoryHandler,
  GetQcExecutionFilterOptionsHandler,
];
