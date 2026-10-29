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
  ViewPmOverview,
} from '../../screenplay/maintenance-management/pm-schedule';
import { lookedAtPmSchedule } from '../../screenplay/common/pm-schedule-view-context';

// daily-pm-schedule.feature. «… برنامه روزانه را مشاهده می کند» opens `/pm-schedule/daily`, and the
// `Then`s that follow it read that page — what the inspector sees. The «تلاش …» attempts go through
// the API (`GET pm-schedule/daily` / `GET pm-schedule/overview`, 403). The plan and the recording
// are preconditions, over the API as the system admin. «امروز …», the background's equipment, the
// plan item and «وضعیت … برای موعد … باشد» live in ./common.steps.ts.

Given(
  'اینکه برنامه تجهیز {string} به صورت زیر باشد',
  (equipmentName: string, table: DataTable) =>
    asTheSystemAdmin(
      ...table.hashes().map((row) =>
        PutActivityInPmPlan({
          equipmentName,
          activityName: row['فعالیت'],
          intervalDays: row['دوره (روز)'],
          firstDueDate: row['اولین موعد'],
        }),
      ),
    ),
);

When('{actor} برنامه روزانه را مشاهده می کند', (actor: Actor) => {
  lookedAtPmSchedule('daily-list');
  return actor.attemptsTo(ViewDailyPmSchedule.using());
});

Then('برنامه روزانه به صورت زیر باشد', (table: DataTable) =>
  actorInTheSpotlight().attemptsTo(EnsureDailyPmScheduleShows(table.hashes())),
);

// قانون: کار انجام شده دیگر در برنامه روزانه نمی آید

Given('انجام {maintenanceTask} ثبت شده باشد', (maintenanceTask: string) =>
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

When(
  '{actor} تلاش می کند برنامه کلی تعمیرات و نگهداری را مشاهده کند',
  (actor: Actor) => actor.attemptsTo(ViewPmOverview.viaApiUsing()),
);

Then('برنامه کلی تعمیرات و نگهداری نمایش داده نشود', () =>
  actorInTheSpotlight().attemptsTo(EnsureTheScheduleWasNotShown()),
);
