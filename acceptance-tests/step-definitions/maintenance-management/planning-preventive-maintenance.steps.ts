import { Given, Then, When } from '@cucumber/cucumber';
import { Actor, actorCalled, actorInTheSpotlight } from '@serenity-js/core';
import {
  asTheSystemAdmin,
  asTheSystemAdminOn,
} from '../../screenplay/maintenance-management/maintenance-records';
import {
  RegisterEquipmentUnlessRegistered,
  RetireEquipment,
} from '../../screenplay/maintenance-management/equipment';
import { RegisterMaintenanceActivityUnlessRegistered } from '../../screenplay/maintenance-management/maintenance-activity';
import {
  AddActivityToPmPlan,
  ChangePmInterval,
  EnsureActivityIsInPmPlanWithInterval,
  EnsureActivityIsNotInPmPlan,
  EnsureDuplicatePlanItemErrorShown,
  EnsureFirstDueDateOfThatPlanItem,
  EnsureNextDueDate,
  EnsurePlanItemFieldErrorShown,
  EnsureToldPlansAreDayBasedOnly,
  PutActivityInPmPlan,
  RemoveActivityFromPmPlan,
  UNSTATED_FIRST_DUE_DATE,
  UNSTATED_INTERVAL_DAYS,
} from '../../screenplay/maintenance-management/pm-plan';
import {
  EnsureMaintenanceHistoryIs,
  EnsureExecutionIsStillInHistory,
  recordedAsAPrecondition,
  recordedByAsAPrecondition,
} from '../../screenplay/maintenance-management/pm-executions';
import {
  EnsureNothingOfEquipmentInDailyPmScheduleViaApi,
  EnsureNotInDailyPmScheduleViaApi,
} from '../../screenplay/maintenance-management/pm-schedule';
import { DataTable } from '@cucumber/cucumber';

// planning-preventive-maintenance.feature. The plain-voice actions — adding to a plan, changing an
// interval, removing an item, retiring equipment — drive `/pm-plans` and `/equipment`; the «تلاش
// …» attempts (403, and the usage-based 400) go through the API, as do every precondition and every
// fact (read by the system admin: the plan from `GET equipment/:id`, the history from
// `GET equipment/:id/maintenance-history`, the daily list of a named day from
// `GET pm-schedule/daily` with the clock moved to that day). The «اینکه فعالیت … و اولین موعد …»
// precondition lives in ./common.steps.ts.

Given(
  'اینکه تجهیزهای {string} و {string} در سیستم ثبت شده باشند',
  (first: string, second: string) =>
    asTheSystemAdmin(
      RegisterEquipmentUnlessRegistered(first),
      RegisterEquipmentUnlessRegistered(second),
    ),
);

Given(
  'فعالیت های {string} و {string} در سیستم ثبت شده باشند',
  (first: string, second: string) =>
    asTheSystemAdmin(
      RegisterMaintenanceActivityUnlessRegistered(first),
      RegisterMaintenanceActivityUnlessRegistered(second),
    ),
);

When(
  '{actor} فعالیت {string} را با دوره {string} روز و اولین موعد {string} به برنامه تجهیز {string} اضافه می کند',
  (
    actor: Actor,
    activityName: string,
    intervalDays: string,
    firstDueDate: string,
    equipmentName: string,
  ) =>
    actor.attemptsTo(
      AddActivityToPmPlan.using({
        equipmentName,
        activityName,
        intervalDays,
        firstDueDate,
      }),
    ),
);

Then(
  'فعالیت {string} با دوره {string} روز در برنامه تجهیز {string} باشد',
  (activityName: string, intervalDays: string, equipmentName: string) =>
    asTheSystemAdmin(
      EnsureActivityIsInPmPlanWithInterval(
        equipmentName,
        activityName,
        intervalDays,
      ),
    ),
);

Then('اولین موعد آن {string} باشد', (firstDueDate: string) =>
  asTheSystemAdmin(EnsureFirstDueDateOfThatPlanItem(firstDueDate)),
);

// قانون: فقط مدیر فنی و مدیر سیستم مجاز به تعریف و تغییر برنامه تجهیزات هستند
// («پیغام خطای عدم دسترسی نشان داده شود» — step-definitions/common.steps.ts)

When(
  '{actor} تلاش می کند فعالیت {string} را به برنامه تجهیز {string} اضافه کند',
  (actor: Actor, activityName: string, equipmentName: string) =>
    actor.attemptsTo(
      AddActivityToPmPlan.viaApiUsing({
        equipmentName,
        activityName,
        intervalDays: UNSTATED_INTERVAL_DAYS,
        intervalUnit: 'days',
        firstDueDate: UNSTATED_FIRST_DUE_DATE,
      }),
    ),
);

Then(
  'فعالیت {string} در برنامه تجهیز {string} نباشد',
  (activityName: string, equipmentName: string) =>
    asTheSystemAdmin(EnsureActivityIsNotInPmPlan(equipmentName, activityName)),
);

// قانون: دوره و اولین موعد هر فعالیت در برنامه تجهیز الزامی است
//
// «<مورد>» is «دوره» or the two-word «اولین موعد», which a Cucumber-expression alternative cannot
// hold — so these two are regular expressions, and the actor is summoned by name.

const MISSING_FIELD: Record<string, 'interval' | 'firstDueDate'> = {
  دوره: 'interval',
  'اولین موعد': 'firstDueDate',
};

When(
  /^(\S+) فعالیت "([^"]*)" را بدون (دوره|اولین موعد) به برنامه تجهیز "([^"]*)" اضافه می کند$/,
  (
    actorName: string,
    activityName: string,
    missing: string,
    equipmentName: string,
  ) =>
    actorCalled(actorName).attemptsTo(
      AddActivityToPmPlan.using({
        equipmentName,
        activityName,
        ...(MISSING_FIELD[missing] === 'interval'
          ? { firstDueDate: UNSTATED_FIRST_DUE_DATE }
          : { intervalDays: UNSTATED_INTERVAL_DAYS }),
      }),
    ),
);

Then(/^پیغام خطای (دوره|اولین موعد) نشان داده شود$/, (missing: string) =>
  actorInTheSpotlight().attemptsTo(
    EnsurePlanItemFieldErrorShown(MISSING_FIELD[missing]),
  ),
);

// قانون: یک فعالیت می تواند برای تجهیزات مختلف دوره های متفاوت داشته باشد

const addWithoutAFirstDueDate = (
  actor: Actor,
  activityName: string,
  intervalDays: string,
  equipmentName: string,
) =>
  actor.attemptsTo(
    AddActivityToPmPlan.using({
      equipmentName,
      activityName,
      intervalDays,
      firstDueDate: UNSTATED_FIRST_DUE_DATE,
    }),
  );

When(
  '{actor} فعالیت {string} را با دوره {string} روز به برنامه تجهیز {string} اضافه می کند',
  addWithoutAFirstDueDate,
);

// The same, continuing with «و» and no subject: whoever acted last.
When(
  'فعالیت {string} را با دوره {string} روز به برنامه تجهیز {string} اضافه می کند',
  (activityName: string, intervalDays: string, equipmentName: string) =>
    addWithoutAFirstDueDate(
      actorInTheSpotlight(),
      activityName,
      intervalDays,
      equipmentName,
    ),
);

Then(
  'دوره {string} در برنامه {string} برابر {string} روز باشد',
  (activityName: string, equipmentName: string, intervalDays: string) =>
    asTheSystemAdmin(
      EnsureActivityIsInPmPlanWithInterval(
        equipmentName,
        activityName,
        intervalDays,
      ),
    ),
);

// قانون: هر فعالیت فقط یک بار در برنامه یک تجهیز می آید

Given(
  'اینکه فعالیت {string} با دوره {string} روز در برنامه تجهیز {string} باشد',
  (activityName: string, intervalDays: string, equipmentName: string) =>
    asTheSystemAdmin(
      PutActivityInPmPlan({
        equipmentName,
        activityName,
        intervalDays,
        firstDueDate: UNSTATED_FIRST_DUE_DATE,
      }),
    ),
);

Then(
  'فعالیت {string} فقط یک بار و با دوره {string} روز در برنامه تجهیز {string} باشد',
  (activityName: string, intervalDays: string, equipmentName: string) =>
    asTheSystemAdmin(
      EnsureActivityIsInPmPlanWithInterval(
        equipmentName,
        activityName,
        intervalDays,
      ),
    ),
);

Then('پیغام خطای تکراری بودن فعالیت در برنامه تجهیز نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureDuplicatePlanItemErrorShown()),
);

// قانون: برنامه فقط بر اساس گذشت روزها تعریف می شود و برنامه بر اساس ساعت کارکرد پذیرفته نمی شود

When(
  '{actor} تلاش می کند فعالیت {string} را با دوره {string} ساعت کارکرد به برنامه تجهیز {string} اضافه کند',
  (
    actor: Actor,
    activityName: string,
    operatingHours: string,
    equipmentName: string,
  ) =>
    actor.attemptsTo(
      AddActivityToPmPlan.viaApiUsing({
        equipmentName,
        activityName,
        intervalDays: operatingHours,
        intervalUnit: 'operating_hours',
        firstDueDate: UNSTATED_FIRST_DUE_DATE,
      }),
    ),
);

Then('به او گفته شود که برنامه فقط بر اساس روز قابل تعریف است', () =>
  actorInTheSpotlight().attemptsTo(EnsureToldPlansAreDayBasedOnly()),
);

// قانون: موعدها از اولین موعد و با فاصله دوره پشت سر هم می آیند و روز انجام، موعد بعدی را جابجا نمی کند
//
// «… برای موعد «…» در «…» ثبت شده باشد» names the occurrence it expects the recording to land on.
// The backend picks the occurrence, so the due date is not sent; the precondition checks that the
// 201's `dueDate` is the one named.

Given(
  'انجام {maintenanceTask} برای موعد {string} در {string} ثبت شده باشد',
  (maintenanceTask: string, dueDate: string, performedOn: string) =>
    recordedAsAPrecondition(maintenanceTask, performedOn, dueDate),
);

Given(
  'انجام {maintenanceTask} در {string} ثبت شده باشد',
  (maintenanceTask: string, performedOn: string) =>
    recordedAsAPrecondition(maintenanceTask, performedOn),
);

Then(
  'موعد بعدی {maintenanceTask} {string} باشد',
  (maintenanceTask: string, nextDueDate: string) =>
    asTheSystemAdmin(EnsureNextDueDate(maintenanceTask, nextDueDate)),
);

// قانون: تغییر دوره، موعد بعدی را از آخرین موعد و با دوره جدید حساب می کند

When(
  '{actor} دوره {string} در برنامه تجهیز {string} را به {string} روز تغییر می دهد',
  (
    actor: Actor,
    activityName: string,
    equipmentName: string,
    intervalDays: string,
  ) =>
    actor.attemptsTo(
      ChangePmInterval.using(equipmentName, activityName, intervalDays),
    ),
);

// قانون: تغییر برنامه، سوابق انجام قبلی را تغییر نمی دهد

Given(
  '{actorName} انجام {maintenanceTask} را در {string} ساعت {string} ثبت کرده باشد',
  (personaName: string, maintenanceTask: string, date: string, time: string) =>
    recordedByAsAPrecondition(personaName, maintenanceTask, date, time),
);

Then(
  'سابقه تعمیرات {equipmentName} به صورت زیر باشد',
  (equipmentName: string, table: DataTable) =>
    asTheSystemAdmin(EnsureMaintenanceHistoryIs(equipmentName, table.hashes())),
);

// قانون: فعالیتی که از برنامه حذف شده یا تجهیزی که کنار گذاشته شده، دیگر در برنامه روزانه نمی آید ولی سوابقش باقی می ماند

When(
  '{actor} فعالیت {string} را از برنامه تجهیز {string} حذف می کند',
  (actor: Actor, activityName: string, equipmentName: string) =>
    actor.attemptsTo(
      RemoveActivityFromPmPlan.using(equipmentName, activityName),
    ),
);

When('{actor} تجهیز {string} را کنار می گذارد', (actor: Actor, name: string) =>
  actor.attemptsTo(RetireEquipment.using(name)),
);

// «تعویض روغن اکسترودر 1 در برنامه روزانه «…» نباشد» and «هیچ کاری از اکسترودر 1 در برنامه روزانه
// «…» نباشد» are one Cucumber expression — the unquoted `{maintenanceTask}` matches «هیچ کاری از
// اکسترودر 1» as well — so this one definition tells them apart by that opening.
const NOTHING_OF = 'هیچ کاری از ';

Then(
  '{maintenanceTask} در برنامه روزانه {string} نباشد',
  (subject: string, date: string) =>
    asTheSystemAdminOn(
      date,
      subject.startsWith(NOTHING_OF)
        ? EnsureNothingOfEquipmentInDailyPmScheduleViaApi(
            subject.slice(NOTHING_OF.length),
          )
        : EnsureNotInDailyPmScheduleViaApi(subject),
    ),
);

Then(
  'سابقه انجام {maintenanceTask} در {string} همچنان در سابقه تعمیرات {equipmentName} باشد',
  (maintenanceTask: string, performedOn: string, _equipmentName: string) =>
    asTheSystemAdmin(
      EnsureExecutionIsStillInHistory(maintenanceTask, performedOn),
    ),
);
