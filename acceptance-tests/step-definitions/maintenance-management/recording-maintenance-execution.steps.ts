import { Given, Then, When } from '@cucumber/cucumber';
import { Actor } from '@serenity-js/core';
import { asTheSystemAdmin } from '../../screenplay/maintenance-management/maintenance-records';
import {
  EnsureExecutionWasRecorded,
  EnsureNoExecutionWasRecorded,
  RecordMaintenanceExecution,
} from '../../screenplay/maintenance-management/pm-executions';
import {
  EnsureOccurrenceStatus,
  ViewPmOverview,
} from '../../screenplay/maintenance-management/pm-schedule';
import { lookedAtPmSchedule } from '../../screenplay/common/pm-schedule-view-context';

// recording-maintenance-execution.feature. The two recordings that are about *how* — with notes and
// without — go through the daily list's «ثبت انجام» dialog. The plain «… انجام … را ثبت می کند»
// is stated where the rule is the backend's (who may record; which occurrence a recording on
// 06/29, 07/03 or 07/08 lands on — and an early one has no row on the daily list to click), so it
// takes the API, as do the «تلاش …» attempts. «… برنامه کلی … را مشاهده می کند» opens
// `/pm-schedule/overview`; every other fact is read over the API by the system admin. The
// background, «امروز …» and «وضعیت … برای موعد … باشد» live in ./common.steps.ts; «(اینکه) اکنون …
// ساعت … باشد» in step-definitions/common.steps.ts.

When(
  '{actor} انجام {maintenanceTask} را با توضیحات {string} ثبت می کند',
  (actor: Actor, maintenanceTask: string, notes: string) =>
    actor.attemptsTo(RecordMaintenanceExecution.using(maintenanceTask, notes)),
);

// The history table is planning-preventive-maintenance's «سابقه تعمیرات {equipmentName} به صورت زیر
// باشد» (planning-preventive-maintenance.steps.ts), compared on this table's columns.

// قانون: توضیحات انجام اختیاری است

When(
  '{actor} انجام {maintenanceTask} را بدون توضیحات ثبت می کند',
  (actor: Actor, maintenanceTask: string) =>
    actor.attemptsTo(RecordMaintenanceExecution.using(maintenanceTask)),
);

Then(
  'انجام {maintenanceTask} برای موعد {string} توسط {string} ثبت شده باشد',
  (maintenanceTask: string, dueDate: string, personaName: string) =>
    asTheSystemAdmin(
      EnsureExecutionWasRecorded(maintenanceTask, dueDate, personaName),
    ),
);

// قانون: فقط بازرس PM، مدیر فنی و مدیر سیستم مجاز به ثبت انجام فعالیت هستند
// («پیغام خطای عدم دسترسی نشان داده شود» — step-definitions/common.steps.ts)

When(
  '{actor} انجام {maintenanceTask} را ثبت می کند',
  (actor: Actor, maintenanceTask: string) =>
    actor.attemptsTo(RecordMaintenanceExecution.viaApiUsing(maintenanceTask)),
);

When(
  '{actor} تلاش می کند انجام {maintenanceTask} را ثبت کند',
  (actor: Actor, maintenanceTask: string) =>
    actor.attemptsTo(RecordMaintenanceExecution.viaApiUsing(maintenanceTask)),
);

Then('انجامی برای {maintenanceTask} ثبت نشده باشد', (maintenanceTask: string) =>
  asTheSystemAdmin(EnsureNoExecutionWasRecorded(maintenanceTask)),
);

// قانون: هر موعد بر اساس روز ثبت انجام، بموقع یا با تاخیر است و اگر تا موعد بعدی انجام نشود، انجام نشده است

Then(
  'وضعیت {maintenanceTask} برای موعد {string} در برنامه کلی تعمیرات و نگهداری {string} باشد',
  (maintenanceTask: string, dueDate: string, status: string) =>
    asTheSystemAdmin(
      EnsureOccurrenceStatus.viaApi(maintenanceTask, dueDate, status),
    ),
);

// A precondition stated as a fact: nothing was recorded, which a fresh background makes true —
// checked rather than assumed.
Given(
  'هیچ انجامی برای {maintenanceTask} ثبت نشده باشد',
  (maintenanceTask: string) =>
    asTheSystemAdmin(EnsureNoExecutionWasRecorded(maintenanceTask)),
);

When(
  '{actor} برنامه کلی تعمیرات و نگهداری را مشاهده می کند',
  (actor: Actor) => {
    lookedAtPmSchedule('overview-page');
    return actor.attemptsTo(ViewPmOverview.using());
  },
);

// قانون: برای موعدی که انجام نشده حساب شده، دیگر نمی توان انجام ثبت کرد

Then(
  'انجام {maintenanceTask} برای موعد {string} ثبت شده باشد',
  (maintenanceTask: string, dueDate: string) =>
    asTheSystemAdmin(EnsureExecutionWasRecorded(maintenanceTask, dueDate)),
);

Then(
  'وضعیت {maintenanceTask} برای موعد {string} همچنان {string} باشد',
  (maintenanceTask: string, dueDate: string, status: string) =>
    asTheSystemAdmin(
      EnsureOccurrenceStatus.viaApi(maintenanceTask, dueDate, status),
    ),
);
