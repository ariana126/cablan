import { Task } from '@serenity-js/core';
import { MaintenanceActivitiesPage } from '../ui/maintenance-activities-page';
import { LocateMaintenanceActivitiesPage } from './maintenance-pages';
import { readMaintenanceActivities } from './maintenance-api';
import { rememberActivity } from './maintenance-records';
import { namedCatalog } from './named-catalog';

/**
 * The maintenance-activity catalog vocabulary — registring-maintenance-activity.feature, and the
 * activities the PM-plan preconditions need. `POST/PATCH maintenance-activities`,
 * `GET maintenance-activities`; the page is `/maintenance-activities`.
 */
const catalog = namedCatalog({
  noun: 'maintenance activity',
  resource: 'maintenance-activities',
  page: MaintenanceActivitiesPage,
  locatePage: LocateMaintenanceActivitiesPage,
  readAll: readMaintenanceActivities,
  remember: rememberActivity,
});

export const RegisterMaintenanceActivity = catalog.Register;
export const RegisterMaintenanceActivityUnlessRegistered =
  catalog.RegisterUnlessRegistered;
export const RenameMaintenanceActivity = catalog.Rename;
export const EnterNewMaintenanceActivityDetails = catalog.EnterNewDetails;
export const SubmitMaintenanceActivityLeavingTheNameEmpty =
  catalog.SubmitLeavingTheNameEmpty;
export const NoteTheMaintenanceActivitiesBeforeTheAttempt =
  catalog.NoteTheRecordsBeforeTheAttempt;
export const rememberTheMaintenanceActivityRenameTarget =
  catalog.rememberTheRenameTarget;
export const EnsureMaintenanceActivityIsRegistered = catalog.EnsureRegistered;
export const EnsureNoNewMaintenanceActivityWasRegistered =
  catalog.EnsureNothingNewRegistered;
export const EnsureMaintenanceActivityWasNotRenamed = catalog.EnsureNotRenamed;

export const EnsureMaintenanceActivityNameErrorShown = (): Task =>
  catalog.EnsureNameErrorShown('missing');

export const EnsureDuplicateMaintenanceActivityNameErrorShown = (): Task =>
  catalog.EnsureNameErrorShown('duplicate');
