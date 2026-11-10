import { Given, Then, When } from '@cucumber/cucumber';
import { Actor, actorCalled, actorInTheSpotlight } from '@serenity-js/core';
import { LogInAsPersonaUnlessLoggedIn } from '../../screenplay/common/personas';
import {
  asPersonaOn,
  asTheSystemAdmin,
} from '../../screenplay/maintenance-management/maintenance-records';
import { EnsureMaintenanceActivitySpecialty } from '../../screenplay/maintenance-management/maintenance-activity';
import { specialtyNamed } from '../../screenplay/maintenance-management/maintenance-api';
import {
  EnsureHistoryStatusFor,
  EnsureNobodyPerformedInHistory,
  ViewMaintenanceHistory,
} from '../../screenplay/maintenance-management/maintenance-history';
import {
  lookedAtTheMaintenanceHistoryFor,
  theMaintenanceHistoryRangeLookedAt,
} from '../../screenplay/common/maintenance-history-view-context';
import {
  DeleteAllExecutionsOfTheActivePlanItem,
  DeleteMaintenanceExecution,
  EnsureNoExecutionOfTheActivePlanItem,
  EnsureTheExecutionForTheDueDateIsStillInHistory,
  EnsureTheHistoryHoldsOnlyTheDueDate,
} from '../../screenplay/maintenance-management/pm-execution-deletion';
import {
  DeactivateActivityInPmPlan,
  EnsureActivityIsInPmPlanWithInterval,
} from '../../screenplay/maintenance-management/pm-plan';
import {
  putAnEarlierInactiveRowBeforeTheActiveOne,
  ReactivateEquipment,
  reactivationChoicesIn,
} from '../../screenplay/maintenance-management/equipment-lifecycle';
import {
  recordedEachAsAPrecondition,
  EnsureDelayAmountInHistory,
  EnsureExecutionWasRecorded,
  EnsureNoExecutionWasRecorded,
  EnsureOperatingHoursErrorShown,
  EnsureOperatingHoursOfTheLatestRecording,
  RecordMaintenanceExecution,
  recordedByAsAPrecondition,
  recordedByOnAsAPrecondition,
} from '../../screenplay/maintenance-management/pm-executions';
import {
  EnsureOccurrenceDelayAmount,
  EnsureOccurrenceStatus,
} from '../../screenplay/maintenance-management/pm-schedule';
import { ViewPmOverview } from '../../screenplay/maintenance-management/pm-schedule-overview';
import {
  lastPmScheduleLookedAt,
  lookedAtPmSchedule,
} from '../../screenplay/common/pm-schedule-view-context';

// recording-maintenance-execution.feature. The two recordings that are about *how* — with notes and
// without — go through the daily list's «ثبت انجام» dialog. The plain «… انجام … را ثبت می کند»
// is stated where the rule is the backend's (who may record; which occurrence a recording on
// 06/29, 07/03 or 07/08 lands on — and an early one has no row on the daily list to click), so it
// takes the API, as do the «تلاش …» attempts. «… برنامه کلی … را مشاهده می کند» opens
// `/pm-schedule/overview` and switches to «جدول PM», keeping its default range — the current Jalali
// month, which holds every due date these scenarios read (all in 1405/07, «امروز» too); every
// other fact is read over the API by the system admin, for a range of the one due date asked about. The
// background, «امروز …» and «وضعیت … برای موعد … باشد» live in ./common.steps.ts; «(اینکه) اکنون …
// ساعت … باشد» in step-definitions/common.steps.ts.

When(
  '{actor} انجام {maintenanceTask} را با توضیحات {string} ثبت می کند',
  (actor: Actor, maintenanceTask: string, notes: string) =>
    actor.attemptsTo(
      RecordMaintenanceExecution.using(maintenanceTask, { notes }),
    ),
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

// Also planning-preventive-maintenance's «مسلمی تلاش می کند …» on a deactivated row, which no step
// logs مسلمی in for — hence the login unless they already are; the spotlight is put back on them
// afterwards, since provisioning a persona borrows یاشار.
When(
  '{actor} تلاش می کند انجام {maintenanceTask} را ثبت کند',
  async (actor: Actor, maintenanceTask: string) => {
    await actor.attemptsTo(
      LogInAsPersonaUnlessLoggedIn(actor.name),
      RecordMaintenanceExecution.viaApiUsing(maintenanceTask),
    );
    actorCalled(actor.name);
  },
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

// قانون: مقدار تاخیر موعدی که با تاخیر انجام شده تعداد روزهای بین موعد و روز ثبت انجام است و موعدهای دیگر مقدار تاخیری ندارند
// («وضعیت … برای موعد … «…» باشد» — ./common.steps.ts)

// A fact about the history: no scenario opens it, so the system admin reads it over the API.
Then(
  'مقدار تاخیر {maintenanceTask} برای موعد {string} در سابقه تعمیرات {equipmentName} {string} باشد',
  (
    maintenanceTask: string,
    dueDate: string,
    _equipmentName: string,
    delayAmount: string,
  ) =>
    asTheSystemAdmin(
      EnsureDelayAmountInHistory(maintenanceTask, dueDate, delayAmount),
    ),
);

// Like «وضعیت … برای موعد …»: off the overview page when the actor has just looked at it, from
// the overview over the API by the system admin otherwise (`pm-schedule-view-context.ts`).
Then(
  'مقدار تاخیر {maintenanceTask} برای موعد {string} در برنامه کلی تعمیرات و نگهداری {string} باشد',
  (maintenanceTask: string, dueDate: string, delayAmount: string) =>
    lastPmScheduleLookedAt() === 'overview-page'
      ? actorInTheSpotlight().attemptsTo(
          EnsureOccurrenceDelayAmount.onThePage(
            maintenanceTask,
            dueDate,
            delayAmount,
          ),
        )
      : asTheSystemAdmin(
          EnsureOccurrenceDelayAmount.viaApi(
            maintenanceTask,
            dueDate,
            delayAmount,
          ),
        ),
);

// قانون: ساعت کارکرد دستگاه از آخرین انجام همان فعالیت اختیاری است و هر عدد صفر یا بیشتر، با اعشار یا بدون آن، پذیرفته می شود (issue #108)
//
// Recording with or without operating hours is about *how*, like the notes: the daily row's
// «ثبت انجام» dialog, whose «ساعت کارکرد دستگاه» field takes the Gherkin's text as typed — the
// invalid values too, which the dialog refuses on its own field. The history is read over the API
// by the system admin, its `operatingHours` written as the page writes it («N ساعت» / «ثبت نشده»).
// «انجامی برای … ثبت نشده باشد» and «انجام … برای موعد … توسط … ثبت شده باشد» are above.

When(
  '{actor} انجام {maintenanceTask} را با ساعت کارکرد {string} ثبت می کند',
  (actor: Actor, maintenanceTask: string, operatingHours: string) =>
    actor.attemptsTo(
      RecordMaintenanceExecution.using(maintenanceTask, { operatingHours }),
    ),
);

When(
  '{actor} انجام {maintenanceTask} را بدون ساعت کارکرد ثبت می کند',
  (actor: Actor, maintenanceTask: string) =>
    actor.attemptsTo(RecordMaintenanceExecution.using(maintenanceTask)),
);

Then(
  'ساعت کارکرد آن در سابقه تعمیرات {equipmentName} {string} باشد',
  (equipmentName: string, shown: string) =>
    asTheSystemAdmin(
      EnsureOperatingHoursOfTheLatestRecording(equipmentName, shown),
    ),
);

Then('پیغام خطای ساعت کارکرد نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureOperatingHoursErrorShown()),
);

// قانون: مدیر سیستم یک سابقه انجام یا همه سوابق یک ردیف برنامه را برای همیشه حذف می کند و فقط همان سوابق پاک می شوند
// (issue #110)
//
// The two plain deletions drive the equipment's folder (`/pm-plans/:id`): a «سابقه PM» row's «حذف
// سابقه», the active plan row's menu item «حذف همه سوابق», each confirmed. The «تلاش …» attempts
// (403) and the passive «… حذف شده باشد» go through the API; facts are the history over the API,
// read by the system admin. «انجام … برای موعد … در … ثبت شده باشد» (one task or several, joined
// by «و») and «سابقه انجام … در … همچنان در سابقه تعمیرات … باشد» live in
// ./planning-preventive-maintenance.steps.ts; «فعالیت … با دوره … و اولین موعد … در برنامه تجهیز …
// باشد» and «امروز …» in ./common.steps.ts.

Given(
  'اینکه انجام {maintenanceTask} برای موعد {string} در {string} ثبت شده باشد',
  (maintenanceTask: string, dueDate: string, performedOn: string) =>
    recordedEachAsAPrecondition(maintenanceTask, performedOn, dueDate),
);

When(
  '{actor} سابقه انجام {maintenanceTask} برای موعد {string} را حذف می کند',
  (actor: Actor, maintenanceTask: string, dueDate: string) =>
    actor.attemptsTo(
      DeleteMaintenanceExecution.using(maintenanceTask, dueDate),
    ),
);

Then(
  'سابقه تعمیرات {equipmentName} فقط انجام موعد {string} را داشته باشد',
  (equipmentName: string, dueDate: string) =>
    asTheSystemAdmin(
      EnsureTheHistoryHoldsOnlyTheDueDate(equipmentName, dueDate),
    ),
);

// The background put the current row in the plan before this step runs, and an activity has one
// active row at a time — so the earlier row cannot just be added. The current row is deleted (the
// System Admin's capability, taking its executions), the earlier one made and deactivated on its
// day, and the current row and its executions re-made after it
// (`equipment-lifecycle.ts#putAnEarlierInactiveRowBeforeTheActiveOne`).
Given(
  'پیش از ردیف فعلی، ردیف دیگری از {string} با دوره {string} روز در برنامه تجهیز {string} بوده که انجامش در {string} ثبت شده و غیرفعال شده باشد',
  (
    activityName: string,
    intervalDays: string,
    equipmentName: string,
    performedOn: string,
  ) =>
    putAnEarlierInactiveRowBeforeTheActiveOne({
      activityName,
      intervalDays,
      equipmentName,
      performedOn,
    }),
);

When(
  '{actor} همه سوابق ردیف فعال {maintenanceTask} را حذف می کند',
  (actor: Actor, maintenanceTask: string) =>
    actor.attemptsTo(
      DeleteAllExecutionsOfTheActivePlanItem.using(maintenanceTask),
    ),
);

// «هیچ انجامی از تعویض روغن اکسترودر 1 …» and «هیچ انجامی از ردیف فعال تعویض روغن اکسترودر 1 …»
// are one Cucumber expression — the unquoted `{maintenanceTask}` takes «ردیف فعال …» too — so this
// one definition tells them apart by that opening.
const OF_THE_ACTIVE_ROW = 'ردیف فعال ';

Then(
  'هیچ انجامی از {maintenanceTask} در سابقه تعمیرات {equipmentName} نباشد',
  (subject: string, _equipmentName: string) =>
    asTheSystemAdmin(
      subject.startsWith(OF_THE_ACTIVE_ROW)
        ? EnsureNoExecutionOfTheActivePlanItem(
            subject.slice(OF_THE_ACTIVE_ROW.length),
          )
        : EnsureNoExecutionWasRecorded(subject),
    ),
);

Then(
  'فعالیت {string} با دوره {string} روز همچنان در برنامه فعال تجهیز {string} باشد',
  (activityName: string, intervalDays: string, equipmentName: string) =>
    asTheSystemAdmin(
      EnsureActivityIsInPmPlanWithInterval(
        equipmentName,
        activityName,
        intervalDays,
      ),
    ),
);

When(
  '{actor} تلاش می کند سابقه انجام {maintenanceTask} برای موعد {string} را حذف کند',
  (actor: Actor, maintenanceTask: string, dueDate: string) =>
    actor.attemptsTo(
      DeleteMaintenanceExecution.viaApiUsing(maintenanceTask, dueDate),
    ),
);

Then(
  'سابقه انجام {maintenanceTask} برای موعد {string} همچنان در سابقه تعمیرات {equipmentName} باشد',
  (maintenanceTask: string, dueDate: string, _equipmentName: string) =>
    asTheSystemAdmin(
      EnsureTheExecutionForTheDueDateIsStillInHistory(maintenanceTask, dueDate),
    ),
);

// قانون: موعدی که سابقه انجامش حذف شده تا رسیدن موعد بعدی عقب افتاده است و پس از آن انجام نشده حساب می شود
// («وضعیت … برای موعد … باشد» — ./common.steps.ts; «… انجام … را ثبت می کند» and «انجام … برای
// موعد … ثبت شده باشد» — above)

Given(
  'سابقه انجام {maintenanceTask} برای موعد {string} در {string} توسط {actorName} حذف شده باشد',
  (
    maintenanceTask: string,
    dueDate: string,
    date: string,
    personaName: string,
  ) =>
    asPersonaOn(
      personaName,
      date,
      DeleteMaintenanceExecution.asAPrecondition(maintenanceTask, dueDate),
    ),
);

Given(
  'اینکه {actorName} انجام {maintenanceTask} برای موعد {string} را در {string} با ساعت کارکرد {string} ثبت کرده باشد',
  (
    personaName: string,
    maintenanceTask: string,
    dueDate: string,
    date: string,
    operatingHours: string,
  ) =>
    recordedByOnAsAPrecondition(personaName, maintenanceTask, dueDate, date, {
      operatingHours,
    }),
);

// قانون: سابقه تعمیرات هر تجهیز موعدهایی را که تا رسیدن موعد بعدی انجام نشده اند با وضعیت انجام نشده نشان می دهد
// قانون: در بازه زمانی سابقه تعمیرات، موعدهای انجام نشده بر اساس تاریخ موعد و موعدهای انجام شده بر اساس روز انجام انتخاب می شوند
// (issue #114)
//
// **API throughout.** What the history holds — which occurrences count as missed, and which entries
// a range selects (a recording by its Tehran day, a missed occurrence by its due date) — is the
// backend's rule; the folder's «سابقه PM» table only renders what
// `GET equipment/:id/maintenance-history[?from&to]` answers. So «… سابقه تعمیرات … را (با بازه …)
// مشاهده می کند» is that read, as the actor (its 200 checked), and it notes the range it asked for
// (`common/maintenance-history-view-context.ts`); every following fact about the history — the
// table and «خالی» (planning-preventive-maintenance's and registring-equipment's steps), «وضعیت …
// در سابقه تعمیرات …», «انجام دهنده ای …» — is read by the system admin for that same range.
//
// Reused, defined elsewhere: «هیچ انجامی برای … ثبت نشده باشد» (above — recordings only, so it
// still holds once missed occurrences are listed), «تجهیز … در … کنار گذاشته شده باشد»
// (./technical-management-dashboard.steps.ts), «انجام … برای موعد … در … ثبت شده باشد»
// (./planning-preventive-maintenance.steps.ts), «سابقه انجام … در … توسط … حذف شده باشد» (above).

// The background put the activity in the plan with the specialty every unstated activity gets
// (`maintenance-api.ts#UNSTATED_SPECIALTY`, «مکانیک»), and an activity in a plan can no longer
// change its specialty (issue #94) — so the precondition is checked, not set.
Given(
  'اینکه تخصص فعالیت {string} {string} باشد',
  (activityName: string, specialty: string) =>
    asTheSystemAdmin(
      EnsureMaintenanceActivitySpecialty(
        activityName,
        specialtyNamed(specialty),
      ),
    ),
);

const recordedByAt = (
  personaName: string,
  maintenanceTask: string,
  dueDate: string,
  date: string,
  time: string,
) =>
  recordedByAsAPrecondition(personaName, maintenanceTask, date, time, dueDate);

Given(
  'اینکه {actorName} انجام {maintenanceTask} برای موعد {string} را در {string} ساعت {string} ثبت کرده باشد',
  recordedByAt,
);

Given(
  '{actorName} انجام {maintenanceTask} برای موعد {string} را در {string} ساعت {string} ثبت کرده باشد',
  recordedByAt,
);

Given(
  'اینکه فعالیت {string} در {string} توسط {actorName} در برنامه تجهیز {string} غیرفعال شده باشد',
  (
    activityName: string,
    date: string,
    personaName: string,
    equipmentName: string,
  ) =>
    asPersonaOn(
      personaName,
      date,
      DeactivateActivityInPmPlan.asAPrecondition(equipmentName, activityName),
    ),
);

// How each row resumes is stated after «با …» — a regular expression over that clause, like the
// plain reactivation (./planning-preventive-maintenance.steps.ts). Only the System Admin
// reactivates (issue #110), so یاشار does, on the day named.
Given(
  /^تجهیز "([^"]*)" در "([^"]*)" با (.+) دوباره فعال شده باشد$/,
  (equipmentName: string, date: string, choices: string) =>
    asPersonaOn(
      'یاشار',
      date,
      ReactivateEquipment.asAPrecondition(
        equipmentName,
        reactivationChoicesIn(choices).rescheduled,
      ),
    ),
);

When(
  '{actor} سابقه تعمیرات {equipmentName} را مشاهده می کند',
  (actor: Actor, equipmentName: string) => {
    lookedAtTheMaintenanceHistoryFor(undefined);
    return actor.attemptsTo(ViewMaintenanceHistory.viaApiUsing(equipmentName));
  },
);

When(
  '{actor} سابقه تعمیرات {equipmentName} را با بازه {string} تا {string} مشاهده می کند',
  (actor: Actor, equipmentName: string, from: string, to: string) => {
    lookedAtTheMaintenanceHistoryFor({ from, to });
    return actor.attemptsTo(
      ViewMaintenanceHistory.viaApiUsing(equipmentName, { from, to }),
    );
  },
);

Then(
  'وضعیت {maintenanceTask} برای موعد {string} در سابقه تعمیرات {equipmentName} {string} باشد',
  (
    maintenanceTask: string,
    dueDate: string,
    _equipmentName: string,
    status: string,
  ) =>
    asTheSystemAdmin(
      EnsureHistoryStatusFor(
        maintenanceTask,
        dueDate,
        status,
        theMaintenanceHistoryRangeLookedAt(),
      ),
    ),
);

Then(
  'انجام دهنده ای برای موعد {string} در سابقه تعمیرات {equipmentName} نباشد',
  (dueDate: string, equipmentName: string) =>
    asTheSystemAdmin(
      EnsureNobodyPerformedInHistory(
        equipmentName,
        dueDate,
        theMaintenanceHistoryRangeLookedAt(),
      ),
    ),
);
