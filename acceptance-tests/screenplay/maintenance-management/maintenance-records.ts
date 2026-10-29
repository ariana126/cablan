import { Activity, actorCalled, actorInTheSpotlight } from '@serenity-js/core';
import { LetItBeToday } from '../common/clock';
import { LogInAsPersona, RenewApiSession } from '../common/personas';
import { keepingTheSpotlight } from '../common/spotlight';

/**
 * What the suite knows about the maintenance records a scenario has created — ids by name — so a
 * *different* actor than the one who created a record (the «تلاش …» outlines' whole point) can
 * address it over the API, and a UI task can address it by the name the page shows.
 *
 * Plain module state, like the other areas' registries, but **cleared before every scenario**
 * (`step-definitions/maintenance-management/common.steps.ts`): `theMaintenanceTaskNamed` decides
 * where an activity's name ends by the equipment registered *in this scenario*, and a stale name
 * from an earlier one must not take part. Never used to decide whether something exists — the
 * «… unless registered» preconditions ask the system (`acceptance-tests/CLAUDE.md`).
 */

export interface RegisteredEquipment {
  id: string;
  name: string;
}

export interface RegisteredActivity {
  id: string;
  name: string;
}

export interface RegisteredPlanItem {
  id: string;
  equipment: RegisteredEquipment;
  activity: RegisteredActivity;
}

const equipmentByName = new Map<string, RegisteredEquipment>();
let lastRegisteredEquipment: RegisteredEquipment | undefined;
const activitiesByName = new Map<string, RegisteredActivity>();
const planItemsByKey = new Map<string, RegisteredPlanItem>();

const planItemKey = (equipmentName: string, activityName: string): string =>
  `${equipmentName}\u0000${activityName}`;

export const forgetMaintenanceRecords = (): void => {
  equipmentByName.clear();
  lastRegisteredEquipment = undefined;
  activitiesByName.clear();
  planItemsByKey.clear();
};

export const rememberEquipment = (equipment: RegisteredEquipment): void => {
  equipmentByName.set(equipment.name, equipment);
  lastRegisteredEquipment = equipment;
};

/** «آن تجهیز» — the equipment the scenario's last precondition registered. */
export const theLastRegisteredEquipment = (): RegisteredEquipment => {
  if (!lastRegisteredEquipment) {
    throw new Error('No equipment has been registered in this scenario.');
  }
  return lastRegisteredEquipment;
};

export const theEquipmentNamed = (name: string): RegisteredEquipment => {
  const equipment = equipmentByName.get(name);
  if (!equipment) {
    throw new Error(
      `No equipment named "${name}" has been registered in this scenario.`,
    );
  }
  return equipment;
};

export const rememberActivity = (activity: RegisteredActivity): void => {
  activitiesByName.set(activity.name, activity);
};

export const theActivityNamed = (name: string): RegisteredActivity => {
  const activity = activitiesByName.get(name);
  if (!activity) {
    throw new Error(
      `No maintenance activity named "${name}" has been registered in this scenario.`,
    );
  }
  return activity;
};

export const rememberPlanItem = (item: RegisteredPlanItem): void => {
  planItemsByKey.set(
    planItemKey(item.equipment.name, item.activity.name),
    item,
  );
};

export const thePlanItemFor = (
  equipmentName: string,
  activityName: string,
): RegisteredPlanItem => {
  const item = planItemsByKey.get(planItemKey(equipmentName, activityName));
  if (!item) {
    throw new Error(
      `"${activityName}" has not been put in the PM plan of "${equipmentName}" in this scenario.`,
    );
  }
  return item;
};

/** One activity of one piece of equipment — «تعویض روغن اکسترودر 1». */
export interface MaintenanceTask {
  activityName: string;
  equipmentName: string;
}

/**
 * Splits an unquoted «تعویض روغن اکسترودر 1» into its activity and its equipment. The Gherkin
 * writes the two back to back with nothing between them, and either may have several words, so
 * the split is made at the equipment this scenario registered: the longest registered name the
 * text ends with.
 */
export const theMaintenanceTaskNamed = (text: string): MaintenanceTask => {
  const trimmed = text.trim();
  const equipmentName = [...equipmentByName.keys()]
    .filter((name) => trimmed.endsWith(` ${name}`))
    .sort((a, b) => b.length - a.length)[0];
  if (!equipmentName) {
    throw new Error(
      `"${text}" names no equipment registered in this scenario ` +
        `(registered: ${[...equipmentByName.keys()].join(', ') || 'none'}).`,
    );
  }
  return {
    activityName: trimmed.slice(0, -(equipmentName.length + 1)).trim(),
    equipmentName,
  };
};

/**
 * Who sets up preconditions and reads facts: the system admin, who may do everything maintenance
 * offers. Doing it as somebody else is what keeps the acting actor's last response intact for a
 * following «پیغام خطای …», and `keepingTheSpotlight` keeps a following bare `Then` speaking about
 * the actor rather than the observer. No maintenance step reads یاشار's own last response after
 * one of these, so یاشار observing even when he just acted is safe.
 *
 * Logs in afresh every time: preconditions move the system's clock, and a session from before a
 * forward jump has expired.
 */
export const asTheSystemAdmin = (...activities: Activity[]): Promise<void> =>
  keepingTheSpotlight(() =>
    actorCalled('یاشار').attemptsTo(LogInAsPersona('یاشار'), ...activities),
  );

/**
 * The same, on another day: the system's clock is moved to `date` first — «… در برنامه روزانه
 * «1405/07/08» نباشد» asks what the daily list says *that* day, and the list is always today's.
 */
export const asTheSystemAdminOn = (
  date: string,
  ...activities: Activity[]
): Promise<void> =>
  keepingTheSpotlight(() =>
    actorCalled('یاشار').attemptsTo(
      LetItBeToday(date),
      LogInAsPersona('یاشار'),
      ...activities,
    ),
  );

/**
 * After the system's clock has jumped, the actor in the spotlight — the one the following steps
 * speak about — gets a fresh API session; there may be nobody in the spotlight yet.
 */
export const renewTheSessionInTheSpotlight = async (): Promise<void> => {
  let actor;
  try {
    actor = actorInTheSpotlight();
  } catch {
    return;
  }
  await actor.attemptsTo(RenewApiSession());
};

/**
 * «امروز «1405/07/15» باشد» — the system's clock moved to that Tehran date (by the system admin,
 * leaving the spotlight where it was), and the session of whoever the scenario follows renewed.
 */
export const letItBeToday = async (date: string): Promise<void> => {
  await keepingTheSpotlight(() =>
    actorCalled('یاشار').attemptsTo(LetItBeToday(date)),
  );
  await renewTheSessionInTheSpotlight();
};
