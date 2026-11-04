import { Activity, actorCalled, actorInTheSpotlight } from '@serenity-js/core';
import { LetItBeToday } from '../common/clock';
import {
  LogInAsPersona,
  LogInAsPersonaUnlessLoggedIn,
  RenewApiSession,
} from '../common/personas';
import { keepingTheSpotlight } from '../common/spotlight';
import type { ActivitySpecialty } from './maintenance-api';

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
  /**
   * As registered or as last read (issue #108); absent when the suite does not know it. An edit
   * over the API sends it back unchanged when only the name is meant to change.
   */
  specialty?: ActivitySpecialty | null;
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

/** Every equipment registered in this scenario, in no particular order. */
export const everyRegisteredEquipment = (): RegisteredEquipment[] => [
  ...equipmentByName.values(),
];

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
 * «تعویض روغن اکسترودر 1 و تعویض روغن اکسترودر 2» — several tasks joined by «و» (issue #110's
 * «انجام … و … ثبت شده باشد»), each one ending in an equipment registered in this scenario. An
 * activity's own name may hold «و» («تعویض روغن و فیلتر»), so the text is split at an «و» only where
 * the part before it ends in such an equipment. A text naming one task comes back as itself.
 */
export const theMaintenanceTasksNamed = (text: string): string[] => {
  const endsInAnEquipment = (part: string): boolean =>
    [...equipmentByName.keys()].some((name) => part.endsWith(` ${name}`));
  const tasks: string[] = [];
  let current = '';
  for (const part of text.trim().split(' و ')) {
    current = current === '' ? part : `${current} و ${part}`;
    if (endsInAnEquipment(current)) {
      tasks.push(current);
      current = '';
    }
  }
  if (current !== '') {
    tasks.push(current);
  }
  return tasks;
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
 * Who reads a fact about the maintenance catalog right after an attempt whose answer a later step
 * still judges: the system admin, unless the system admin **is** the actor who just acted
 * (legacy specialty assignment, issue #108) — then the technical manager, so یاشار's last response
 * survives for «پیغام خطای …» / «به او گفته شود …». رضازاده observes with the session he already
 * has (renewed, in case the clock has moved): logging him in from scratch would provision his
 * account through یاشار and overwrite that very response. registring-maintenance-activity's
 * background logs him in, which is the only feature that needs this.
 */
export const asAMaintenanceObserver = async (
  ...activities: Activity[]
): Promise<void> => {
  let acting: string | undefined;
  try {
    acting = actorInTheSpotlight().name;
  } catch {
    acting = undefined;
  }
  if (acting !== 'یاشار') {
    return asTheSystemAdmin(...activities);
  }
  return keepingTheSpotlight(() =>
    actorCalled('رضازاده').attemptsTo(
      LogInAsPersonaUnlessLoggedIn('رضازاده'),
      RenewApiSession(),
      ...activities,
    ),
  );
};

/** A precondition stated of a named persona, today — logged in afresh, the spotlight left as it was. */
export const asPersona = (
  personaName: string,
  ...activities: Activity[]
): Promise<void> =>
  keepingTheSpotlight(() =>
    actorCalled(personaName).attemptsTo(
      LogInAsPersona(personaName),
      ...activities,
    ),
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
 * A precondition stated of a named persona on a given day — «رضازاده … را در «1405/07/10» …
 * کرده باشد»: the system's clock is moved to that Tehran date (10:00) first, then the persona logs
 * in (a session from before the jump has expired) and acts. The spotlight stays where it was, and
 * its actor's session is renewed afterwards, since the clock has moved under it.
 */
export const asPersonaOn = async (
  personaName: string,
  date: string,
  ...activities: Activity[]
): Promise<void> => {
  await keepingTheSpotlight(() =>
    actorCalled(personaName).attemptsTo(
      LetItBeToday(date),
      LogInAsPersona(personaName),
      ...activities,
    ),
  );
  await renewTheSessionInTheSpotlight();
};

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
