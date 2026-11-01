import { DataTable, Given, Then, When } from '@cucumber/cucumber';
import { Actor, actorInTheSpotlight } from '@serenity-js/core';
import { asPersonaOn } from '../../screenplay/maintenance-management/maintenance-records';
import { DeactivateActivityInPmPlan } from '../../screenplay/maintenance-management/pm-plan';
import { RetireEquipment } from '../../screenplay/maintenance-management/equipment';
import { recordedByOnAsAPrecondition } from '../../screenplay/maintenance-management/pm-executions';
import {
  dueDatesWithStatusIn,
  EnsureInPmCalendar,
  EnsureOverviewDueDatesOf,
  EnsureOverviewOccurrence,
  EnsureOverviewOccurrencesOf,
  EnsurePmCalendarShows,
  EnsurePmOverviewShows,
  EnsureToldTheRangeIsInvalid,
  PmOverviewChoice,
  ViewPmCalendar,
  ViewPmOverview,
} from '../../screenplay/maintenance-management/pm-schedule-overview';
import { lookedAtPmSchedule } from '../../screenplay/common/pm-schedule-view-context';

// pm-schedule-overview.feature (issue #90). Every «… مشاهده می کند» drives `/pm-schedule/overview`
// — the table view with its range and filters, or the calendar turned to a month — and the `Then`s
// that follow read that page. The «تلاش …» invalid-range attempts go through the API (400
// `invalid-pm-schedule-range`). Every precondition is the API's, the clock moved to its day first.
//
// Reused, not redefined: the background (./common.steps.ts and step-definitions/common.steps.ts),
// «(اینکه) فعالیت … و اولین موعد … در برنامه تجهیز … باشد» and «امروز … باشد» (./common.steps.ts),
// «هیچ انجامی برای … ثبت نشده باشد» (./recording-maintenance-execution.steps.ts), «انجام … برای موعد
// … در … ثبت شده باشد» (./planning-preventive-maintenance.steps.ts), «اینکه برنامه تجهیز … به صورت
// زیر باشد» (./daily-pm-schedule.steps.ts) and «برنامه کلی تعمیرات و نگهداری نمایش داده نشود»
// (./daily-pm-schedule.steps.ts).

const viewTheTable = (actor: Actor, choice: PmOverviewChoice) => {
  lookedAtPmSchedule('overview-page');
  return actor.attemptsTo(ViewPmOverview.using(choice));
};

// قانون: همه موعدهایی که تاریخ موعدشان داخل بازه است، از جمله موعدهای آینده، هر کدام با وضعیت امروزشان در برنامه کلی می آیند

When(
  '{actor} برنامه کلی تعمیرات و نگهداری را از {string} تا {string} مشاهده می کند',
  (actor: Actor, from: string, to: string) =>
    viewTheTable(actor, { range: { from, to } }),
);

Then('برنامه کلی تعمیرات و نگهداری به صورت زیر باشد', (table: DataTable) =>
  actorInTheSpotlight().attemptsTo(EnsurePmOverviewShows(table.hashes())),
);

Then(
  'موعدهای {maintenanceTask} در برنامه کلی تعمیرات و نگهداری فقط {string}، {string} و {string} باشند',
  (maintenanceTask: string, first: string, second: string, third: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureOverviewDueDatesOf(maintenanceTask, [first, second, third]),
    ),
);

When(
  '{actor} تقویم برنامه کلی تعمیرات و نگهداری را برای ماه {string} مشاهده می کند',
  (actor: Actor, month: string) => {
    lookedAtPmSchedule('overview-calendar');
    return actor.attemptsTo(ViewPmCalendar.forMonth(month));
  },
);

Then(
  'تقویم برنامه کلی تعمیرات و نگهداری به صورت زیر باشد',
  (table: DataTable) =>
    actorInTheSpotlight().attemptsTo(EnsurePmCalendarShows(table.hashes())),
);

// قانون: بازه برنامه کلی بر اساس تاریخ موعد است نه روز انجام

Then(
  'موعد {string} {maintenanceTask} در برنامه کلی تعمیرات و نگهداری با وضعیت {string} و تاخیر {string} باشد',
  (
    dueDate: string,
    maintenanceTask: string,
    status: string,
    delayAmount: string,
  ) =>
    actorInTheSpotlight().attemptsTo(
      EnsureOverviewOccurrence.is(
        maintenanceTask,
        dueDate,
        status,
        delayAmount,
      ),
    ),
);

Then(
  'موعد {string} {maintenanceTask} در برنامه کلی تعمیرات و نگهداری نباشد',
  (dueDate: string, maintenanceTask: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureOverviewOccurrence.isAbsent(maintenanceTask, dueDate),
    ),
);

// قانون: بازه برنامه کلی باید روز شروع و روز پایان داشته باشد و روز شروع نمی تواند بعد از روز پایان باشد
// (the three «<بازه>» examples are three sentences, so three definitions)

When(
  '{actor} تلاش می کند برنامه کلی تعمیرات و نگهداری را بدون روز شروع تا {string} مشاهده کند',
  (actor: Actor, to: string) =>
    actor.attemptsTo(ViewPmOverview.viaApiUsing({ to })),
);

When(
  '{actor} تلاش می کند برنامه کلی تعمیرات و نگهداری را از {string} بدون روز پایان مشاهده کند',
  (actor: Actor, from: string) =>
    actor.attemptsTo(ViewPmOverview.viaApiUsing({ from })),
);

When(
  '{actor} تلاش می کند برنامه کلی تعمیرات و نگهداری را از {string} تا {string} مشاهده کند',
  (actor: Actor, from: string, to: string) =>
    actor.attemptsTo(ViewPmOverview.viaApiUsing({ from, to })),
);

Then('پیغام خطای بازه نامعتبر نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureToldTheRangeIsInvalid()),
);

// قانون: در تقویم، کاری که با تاخیر انجام شده در روز انجام می آید و موعدی که انجام نشده در روز موعد خودش می ماند

Then(
  '{maintenanceTask} با موعد {string} فقط یک بار و در روز {string} با وضعیت {string} و تاخیر {string} در تقویم باشد',
  (
    maintenanceTask: string,
    dueDate: string,
    day: string,
    status: string,
    delayAmount: string,
  ) =>
    actorInTheSpotlight().attemptsTo(
      EnsureInPmCalendar(maintenanceTask, dueDate, {
        day,
        status,
        delayAmount,
      }),
    ),
);

Then(
  '{maintenanceTask} با موعد {string} در روز {string} با وضعیت {string} در تقویم باشد',
  (maintenanceTask: string, dueDate: string, day: string, status: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureInPmCalendar(maintenanceTask, dueDate, { day, status }),
    ),
);

// قانون: موعدهای فعالیتی که از برنامه حذف شده تا خود روز حذف در برنامه کلی می مانند و پس از آن موعدی برایش نمی آید
//
// The rule keeps its «حذف» wording, but a plan row is no longer removed (issue #91): «… حذف کرده
// باشد» is carried out by deactivating the row that day.

Given(
  '{actorName} فعالیت {string} را در {string} از برنامه تجهیز {string} حذف کرده باشد',
  (
    personaName: string,
    activityName: string,
    date: string,
    equipmentName: string,
  ) =>
    asPersonaOn(
      personaName,
      date,
      DeactivateActivityInPmPlan.asAPrecondition(equipmentName, activityName),
    ),
);

// «<موعدها>» — «1405/07/01 بموقع، 1405/07/08 انجام نشده» — comes after the step as its argument.
// Taken either as a one-cell data table or as a doc string, whichever the feature file settles on.
Then(
  'موعدهای {maintenanceTask} در برنامه کلی تعمیرات و نگهداری به صورت زیر باشند',
  (maintenanceTask: string, listing: DataTable | string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureOverviewOccurrencesOf(
        maintenanceTask,
        dueDatesWithStatusIn(
          typeof listing === 'string'
            ? listing
            : listing.raw().flat().join('، '),
        ),
      ),
    ),
);

// قانون: کنار گذاشتن تجهیز مثل حذف همه فعالیت های آن در همان روز است و سوابق آن در برنامه کلی می ماند

Given(
  '{actorName} تجهیز {string} را در {string} کنار گذاشته باشد',
  (personaName: string, equipmentName: string, date: string) =>
    asPersonaOn(personaName, date, RetireEquipment.viaApiUsing(equipmentName)),
);

When(
  '{actor} برنامه کلی تعمیرات و نگهداری تجهیز {string} را از {string} تا {string} مشاهده می کند',
  (actor: Actor, equipmentName: string, from: string, to: string) =>
    viewTheTable(actor, { range: { from, to }, equipmentName }),
);

// قانون: با انتخاب یک انجام دهنده فقط موعدهایی می آیند که انجامشان به نام همان فرد ثبت شده و با انتخاب همه، موعدهای انجام نشده هم می آیند

Given(
  '{actorName} انجام {maintenanceTask} برای موعد {string} را در {string} ثبت کرده باشد',
  (
    personaName: string,
    maintenanceTask: string,
    dueDate: string,
    date: string,
  ) => recordedByOnAsAPrecondition(personaName, maintenanceTask, dueDate, date),
);

When(
  '{actor} برنامه کلی تعمیرات و نگهداری را از {string} تا {string} برای انجام دهنده {string} مشاهده می کند',
  (actor: Actor, from: string, to: string, performer: string) =>
    viewTheTable(actor, { range: { from, to }, performer }),
);
