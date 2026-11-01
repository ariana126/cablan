import { actorCalled } from '@serenity-js/core';
import { FreezeTimeAt } from '../common/clock';
import {
  isoDateToJalaliDate,
  jalaliDatePlusDays,
  tehranJalaliDateOf,
} from '../common/jalali-datetime';
import { readAsTheSystemAdmin } from '../common/observer';
import { keepingTheSpotlight } from '../common/spotlight';
import { systemClock } from '../../support/system-clock';
import { RegisterEquipmentUnlessRegistered } from './equipment';
import {
  EquipmentDetailsReadModel,
  EquipmentReadModel,
} from './maintenance-api';
import {
  asTheSystemAdmin,
  rememberEquipment,
  renewTheSessionInTheSpotlight,
  theEquipmentNamed,
  theLastRegisteredEquipment,
  theMaintenanceTaskNamed,
  thePlanItemFor,
} from './maintenance-records';
import {
  PutActivityInPmPlan,
  UNSTATED_FIRST_DUE_DATE,
  UNSTATED_INTERVAL_DAYS,
} from './pm-plan';
import { recordedAsAPrecondition } from './pm-executions';

/**
 * The bulky preconditions of technical-management-dashboard.feature (issue #89) — a plan with
 * ten past occurrences, twenty active equipment, a run of recordings — built entirely through the
 * public API as the system admin, each recording made *on* the day it names (the clock moved there
 * first, as `pm-executions.ts#recordedAsAPrecondition` does). Async functions rather than tasks:
 * a recording addresses its plan item by id, which exists only once an earlier stage has run.
 *
 * Per-scenario state below is reset by the feature's `Before` hook.
 */

let stepTextsOfTheScenario: string[] = [];
let equipmentLeftWithoutAPlan: string[] | undefined;

export const forgetTheDashboardFixtures = (stepTexts: string[]): void => {
  stepTextsOfTheScenario = stepTexts;
  equipmentLeftWithoutAPlan = undefined;
};

const STATED_TODAY = /^(?:اینکه )?امروز "([^"]+)" باشد$/;

/**
 * The «امروز «…» باشد» the scenario states — possibly in a *later* step than the one asking:
 * «از موعدهای … فقط موعد «…» بدون انجام مانده باشد» precedes it, and what "left undone" means
 * depends on which occurrences are past by then. Read off the pickle, as resampling-bom's `Before`
 * hook looks ahead. Undefined when the scenario states no today.
 */
export const theTodayTheScenarioStates = (): string | undefined =>
  stepTextsOfTheScenario
    .map((text) => STATED_TODAY.exec(text.trim())?.[1])
    .find((date) => date !== undefined);

/** What the system calls «امروز» right now — the Tehran date of its clock. */
const theSystemsToday = (): string => tehranJalaliDateOf(systemClock.now());

/** Due dates of a day-based schedule from `first`, every `intervalDays`, strictly before `until`. */
const dueDatesBefore = (
  first: string,
  intervalDays: number,
  until: string,
): string[] => {
  const dates: string[] = [];
  for (
    let date = first;
    date < until;
    date = jalaliDatePlusDays(date, intervalDays)
  ) {
    dates.push(date);
  }
  return dates;
};

/**
 * «از موعدهای تعویض روغن اکسترودر 1 فقط موعد «1405/07/01» بدون انجام مانده باشد» — every other
 * occurrence due before the scenario's today is recorded on its own due date (so on time); the
 * named one, and today's and later ones, are left alone. The schedule is read from the plan.
 */
export const onlyOneOccurrenceLeftUndone = async (
  maintenanceTask: string,
  undoneDueDate: string,
  today: string = theSystemsToday(),
): Promise<void> => {
  const { equipmentName, activityName } =
    theMaintenanceTaskNamed(maintenanceTask);
  const itemId = thePlanItemFor(equipmentName, activityName).id;
  const equipment = await readAsTheSystemAdmin<EquipmentDetailsReadModel>(
    `equipment/${theEquipmentNamed(equipmentName).id}`,
  );
  const item = equipment.planItems.find((planItem) => planItem.id === itemId);
  if (!item) {
    throw new Error(
      `"${activityName}" is not in the active PM plan of "${equipmentName}".`,
    );
  }
  const dueDates = dueDatesBefore(
    isoDateToJalaliDate(item.firstDueDate),
    item.intervalDays,
    today,
  );
  if (!dueDates.includes(undoneDueDate)) {
    throw new Error(
      `${undoneDueDate} is not an occurrence of ${maintenanceTask} due before ${today} ` +
        `(those are: ${dueDates.join(', ') || 'none'}).`,
    );
  }
  for (const dueDate of dueDates.filter((date) => date !== undoneDueDate)) {
    await recordedAsAPrecondition(maintenanceTask, dueDate, dueDate);
  }
};

/**
 * «انجام موعدهای تعویض روغن اکسترودر 1 به صورت زیر ثبت شده باشد» — each row recorded on its
 * «روز انجام», in the order given, and checked to land on its «موعد».
 */
export const occurrencesRecordedAsListed = async (
  maintenanceTask: string,
  rows: { dueDate: string; performedOn: string }[],
): Promise<void> => {
  for (const { dueDate, performedOn } of rows) {
    await recordedAsAPrecondition(maintenanceTask, performedOn, dueDate);
  }
};

export interface PastOccurrences {
  periodDays: number;
  total: number;
  onTime: number;
  late: number;
  notDone: number;
}

/** The activities the past-occurrences precondition invents — «بازدید دوره ای 1», … */
const PAST_OCCURRENCE_ACTIVITY = 'بازدید دوره ای';

/**
 * «در 30 روز اخیر موعد 10 کار گذشته باشد که 7 کار بموقع و 2 کار با تاخیر انجام شده و 1 کار انجام
 * نشده باشد» — counted back from the system's today, which the step leaves where it was.
 *
 * `total` activities go into the plan of the equipment the scenario registered last (the
 * background's), all first due on the same past day, a third of the period back, with the period as
 * their interval — so each has exactly one occurrence in the period, and the next falls after
 * today. `onTime` of them are recorded that day, `late` of them the day after, the rest not at all
 * (overdue: «انجام نشده» in the performance's sense). Then the clock goes back to the instant it
 * read, so every session issued before the step is still good.
 */
export const pastOccurrencesInTheLastDays = async ({
  periodDays,
  total,
  onTime,
  late,
  notDone,
}: PastOccurrences): Promise<void> => {
  if (onTime + late + notDone !== total) {
    throw new Error(
      `${onTime} on time + ${late} late + ${notDone} not done is not ${total}.`,
    );
  }
  if (periodDays < 3) {
    throw new Error(`A period of ${periodDays} days leaves no room for this.`);
  }
  const now = systemClock.now();
  const dueDate = jalaliDatePlusDays(
    tehranJalaliDateOf(now),
    -Math.floor(periodDays / 3),
  );
  const lateOn = jalaliDatePlusDays(dueDate, 1);
  const equipmentName = theLastRegisteredEquipment().name;
  const activities = Array.from(
    { length: total },
    (_, index) => `${PAST_OCCURRENCE_ACTIVITY} ${index + 1}`,
  );
  const taskOf = (activityName: string) => `${activityName} ${equipmentName}`;

  await asTheSystemAdmin(
    ...activities.map((activityName) =>
      PutActivityInPmPlan({
        equipmentName,
        activityName,
        intervalDays: String(periodDays),
        firstDueDate: dueDate,
      }),
    ),
  );
  for (const activityName of activities.slice(0, onTime)) {
    await recordedAsAPrecondition(taskOf(activityName), dueDate, dueDate);
  }
  for (const activityName of activities.slice(onTime, onTime + late)) {
    await recordedAsAPrecondition(taskOf(activityName), lateOn, dueDate);
  }
  await keepingTheSpotlight(() =>
    actorCalled('یاشار').attemptsTo(FreezeTimeAt(now)),
  );
  await renewTheSessionInTheSpotlight();
};

/** The equipment the twenty-equipment precondition invents — «تجهیز شماره 2», … */
const INVENTED_EQUIPMENT = 'تجهیز شماره';

/** The activity that gives an equipment a plan, when the step names none. */
const ANY_ACTIVITY = 'تعویض روغن';

/**
 * «20 تجهیز فعال در سیستم ثبت شده باشد که 15 تای آن ها فعالیتی در برنامه داشته باشند» — counting
 * what the system already has (the background's equipment is one of the twenty): registers
 * equipment until `activeEquipment` are in service, then puts an activity in the plan of enough of
 * them — those already registered first — that exactly `withPlan` have one. The rest are noted for
 * «فهرست تجهیزات فاقد برنامه همان … تجهیز باشد».
 */
export const activeEquipmentOfWhichSomeArePlanned = async (
  activeEquipment: number,
  withPlan: number,
): Promise<void> => {
  if (withPlan > activeEquipment) {
    throw new Error(
      `${withPlan} of ${activeEquipment} equipment cannot have a plan.`,
    );
  }
  const inService = (
    await readAsTheSystemAdmin<EquipmentReadModel[]>('equipment')
  ).filter((equipment) => !equipment.retired);
  if (inService.length > activeEquipment) {
    throw new Error(
      `${inService.length} equipment are already in service, more than ${activeEquipment}.`,
    );
  }
  const planned: string[] = [];
  const unplanned: string[] = [];
  for (const equipment of inService) {
    rememberEquipment({ id: equipment.id, name: equipment.name });
    const details = await readAsTheSystemAdmin<EquipmentDetailsReadModel>(
      `equipment/${equipment.id}`,
    );
    (details.planItems.length > 0 ? planned : unplanned).push(equipment.name);
  }
  const taken = new Set(inService.map((equipment) => equipment.name));
  const toRegister: string[] = [];
  for (
    let number = 1;
    inService.length + toRegister.length < activeEquipment;
    number += 1
  ) {
    const name = `${INVENTED_EQUIPMENT} ${number}`;
    if (!taken.has(name)) {
      toRegister.push(name);
    }
  }
  await asTheSystemAdmin(
    ...toRegister.map((name) => RegisterEquipmentUnlessRegistered(name)),
  );
  unplanned.push(...toRegister);
  if (planned.length > withPlan) {
    throw new Error(
      `${planned.length} equipment already have a plan, more than ${withPlan}.`,
    );
  }
  const toPlan = unplanned.splice(0, withPlan - planned.length);
  await asTheSystemAdmin(
    ...toPlan.map((equipmentName) =>
      PutActivityInPmPlan({
        equipmentName,
        activityName: ANY_ACTIVITY,
        intervalDays: UNSTATED_INTERVAL_DAYS,
        firstDueDate: UNSTATED_FIRST_DUE_DATE,
      }),
    ),
  );
  equipmentLeftWithoutAPlan = unplanned;
};

/** «همان 5 تجهیز» — the equipment the twenty-equipment precondition left without a plan. */
export const theEquipmentLeftWithoutAPlan = (count: number): string[] => {
  if (equipmentLeftWithoutAPlan === undefined) {
    throw new Error('No step in this scenario left equipment without a plan.');
  }
  if (equipmentLeftWithoutAPlan.length !== count) {
    throw new Error(
      `«همان ${count} تجهیز», but ${equipmentLeftWithoutAPlan.length} were left without a plan: ` +
        equipmentLeftWithoutAPlan.join('، '),
    );
  }
  return equipmentLeftWithoutAPlan;
};
