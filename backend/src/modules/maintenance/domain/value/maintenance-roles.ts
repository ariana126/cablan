import { Role } from '@framework/domain';

/**
 * Who plans maintenance — equipment, the activity catalog, PM plans,
 * retiring equipment: the technical manager and the system admin.
 */
export const MAINTENANCE_PLANNER_ROLES: readonly Role[] = [
  Role.SystemAdmin,
  Role.TechnicalManager,
];

/**
 * Who works the PM schedule — the daily list, the overview, recording an
 * execution, an equipment's history: the planners and the PM inspector.
 */
export const PM_SCHEDULE_ROLES: readonly Role[] = [
  ...MAINTENANCE_PLANNER_ROLES,
  Role.PmInspector,
];
