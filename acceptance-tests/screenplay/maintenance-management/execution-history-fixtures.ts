import {
  asTheSystemAdmin,
  theMaintenanceTaskNamed,
} from './maintenance-records';
import { RegisterEquipmentUnlessRegistered } from './equipment';
import { PutActivityInPmPlan } from './pm-plan';
import { recordedByAsAPrecondition } from './pm-executions';

/** The interval given to a plan item this module sets up — the Gherkin states none. */
const INTERVAL_DAYS = '30';

/**
 * Splits «تعویض روغن اکسترودر 1» when the scenario has registered no equipment to split it at
 * (`maintenance-records.ts#theMaintenanceTaskNamed`): the equipment is the trailing «<name> <number>»,
 * the way every piece of equipment in the specs is named («اکسترودر 1»).
 */
const splitAtTrailingEquipmentName = (
  maintenanceTask: string,
): { activityName: string; equipmentName: string } => {
  const match = /^(.+) (\S+ \d+)$/.exec(maintenanceTask.trim());
  if (!match) {
    throw new Error(
      `"${maintenanceTask}" does not end in an equipment name of the form "<name> <number>".`,
    );
  }
  return { activityName: match[1], equipmentName: match[2] };
};

const isAlreadyATaskOfThisScenario = (maintenanceTask: string): boolean => {
  try {
    theMaintenanceTaskNamed(maintenanceTask);
    return true;
  } catch {
    return false;
  }
};

/**
 * «اینکه مسلمی انجام تعویض روغن اکسترودر 1 را در «…» ساعت «…» ثبت کرده باشد» stated by a feature
 * with no maintenance background (registring-user, issue #94): the equipment, the activity and a
 * plan item whose first due date is the recording's day are set up by the system admin first, so
 * the recording lands on time; then the persona records it at that minute. Where the scenario
 * already registered the equipment, its own plan is used as is.
 */
export const recordedByWithItsPlanAsAPrecondition = async (
  personaName: string,
  maintenanceTask: string,
  date: string,
  time: string,
): Promise<void> => {
  if (!isAlreadyATaskOfThisScenario(maintenanceTask)) {
    const { activityName, equipmentName } =
      splitAtTrailingEquipmentName(maintenanceTask);
    await asTheSystemAdmin(
      RegisterEquipmentUnlessRegistered(equipmentName),
      PutActivityInPmPlan({
        equipmentName,
        activityName,
        intervalDays: INTERVAL_DAYS,
        firstDueDate: date,
      }),
    );
  }
  await recordedByAsAPrecondition(personaName, maintenanceTask, date, time);
};
