import { DataTable, Given, Then, When } from '@cucumber/cucumber';
import { Actor, actorInTheSpotlight } from '@serenity-js/core';
import { asTheSystemAdmin } from '../../screenplay/maintenance-management/maintenance-records';
import { PutActivityInPmPlan } from '../../screenplay/maintenance-management/pm-plan';
import { recordedAsAPrecondition } from '../../screenplay/maintenance-management/pm-executions';
import {
  EnsureDailyPmScheduleShows,
  EnsureDueOnlyOnceInDailyPmSchedule,
  EnsureNotInDailyPmSchedule,
  EnsureOverdueInDailyPmSchedule,
  EnsureTheScheduleWasNotShown,
  ViewDailyPmSchedule,
} from '../../screenplay/maintenance-management/pm-schedule';
import { ViewPmOverview } from '../../screenplay/maintenance-management/pm-schedule-overview';
import { lookedAtPmSchedule } from '../../screenplay/common/pm-schedule-view-context';

// daily-pm-schedule.feature. «… برنامه روزانه را مشاهده می کند» opens `/pm-schedule/daily`, and the
// `Then`s that follow it read that page — what the inspector sees. The «تلاش …» attempts go through
// the API (`GET pm-schedule/daily` / `GET pm-schedule/overview?from&to`, 403). The plan and the recording
// are preconditions, over the API as the system admin. «امروز …», the background's equipment, the
// plan item and «وضعیت … برای موعد … باشد» live in ./common.steps.ts.

// Opening a `Given`, and continuing one (pm-schedule-overview's specialty rule, issue #108).
const thePlanIs = (equipmentName: string, table: DataTable) =>
  asTheSystemAdmin(
    ...table.hashes().map((row) =>
      PutActivityInPmPlan({
        equipmentName,
        activityName: row['فعالیت'],
        intervalDays: row['دوره (روز)'],
        firstDueDate: row['اولین موعد'],
      }),
    ),
  );

Given('اینکه برنامه تجهیز {string} به صورت زیر باشد', thePlanIs);
Given('برنامه تجهیز {string} به صورت زیر باشد', thePlanIs);

When('{actor} برنامه روزانه را مشاهده می کند', (actor: Actor) => {
  lookedAtPmSchedule('daily-list');
  return actor.attemptsTo(ViewDailyPmSchedule.using());
});

Then('برنامه روزانه به صورت زیر باشد', (table: DataTable) =>
  actorInTheSpotlight().attemptsTo(EnsureDailyPmScheduleShows(table.hashes())),
);

// قانون: کار انجام شده دیگر در برنامه روزانه نمی آید

// «انجام تعویض روغن اکسترودر 1 ثبت شده باشد». A regular expression rather than
// 'انجام {maintenanceTask} ثبت شده باشد', because that expression also swallows
// technical-management-dashboard's «انجام موعدهای … به صورت زیر ثبت شده باشد» (a different step,
// with a table) and the two would be ambiguous. The lookahead refuses «موعدهای …»; `[^"]+` keeps
// the quoted «… برای موعد «…» …» / «… در «…» …» forms out, as the unquoted parameter type did.
Given(/^انجام (?!موعدهای )([^"]+) ثبت شده باشد$/, (maintenanceTask: string) =>
  recordedAsAPrecondition(maintenanceTask),
);

Then('{maintenanceTask} در برنامه روزانه نباشد', (maintenanceTask: string) =>
  actorInTheSpotlight().attemptsTo(EnsureNotInDailyPmSchedule(maintenanceTask)),
);

// قانون: کار عقب افتاده فقط تا رسیدن موعد بعدی در برنامه روزانه می ماند و پس از آن انجام نشده حساب می شود

Then(
  '{maintenanceTask} با موعد {string} و {string} روز تاخیر عقب افتاده باشد',
  (maintenanceTask: string, dueDate: string, daysOverdue: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureOverdueInDailyPmSchedule(maintenanceTask, dueDate, daysOverdue),
    ),
);

Then(
  '{maintenanceTask} فقط یک بار و با موعد {string} سررسیده باشد',
  (maintenanceTask: string, dueDate: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureDueOnlyOnceInDailyPmSchedule(maintenanceTask, dueDate),
    ),
);

// قانون: فقط بازرس PM، مدیر فنی و مدیر سیستم مجاز به مشاهده برنامه روزانه و برنامه کلی تعمیرات و نگهداری هستند
// («پیغام خطای عدم دسترسی نشان داده شود» — step-definitions/common.steps.ts)

When('{actor} تلاش می کند برنامه روزانه را مشاهده کند', (actor: Actor) =>
  actor.attemptsTo(ViewDailyPmSchedule.viaApiUsing()),
);

Then('برنامه روزانه نمایش داده نشود', () =>
  actorInTheSpotlight().attemptsTo(EnsureTheScheduleWasNotShown()),
);

// The overview needs a range since issue #90; a valid one is sent, so the refusal can only be the
// 403 (a missing range would be a 400 whatever the role, and pass «… نمایش داده نشود» vacuously).
const ANY_VALID_RANGE = { from: '1405/07/01', to: '1405/07/30' };

When(
  '{actor} تلاش می کند برنامه کلی تعمیرات و نگهداری را مشاهده کند',
  (actor: Actor) =>
    actor.attemptsTo(ViewPmOverview.viaApiUsing(ANY_VALID_RANGE)),
);

Then('برنامه کلی تعمیرات و نگهداری نمایش داده نشود', () =>
  actorInTheSpotlight().attemptsTo(EnsureTheScheduleWasNotShown()),
);
