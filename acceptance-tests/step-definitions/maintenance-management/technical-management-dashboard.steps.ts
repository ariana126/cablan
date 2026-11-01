import { Before, DataTable, Given, Then, When } from '@cucumber/cucumber';
import { Actor, actorInTheSpotlight } from '@serenity-js/core';
import {
  asPersonaOn,
  asTheSystemAdmin,
} from '../../screenplay/maintenance-management/maintenance-records';
import { RetireEquipment } from '../../screenplay/maintenance-management/equipment';
import {
  DeactivateActivityInPmPlan,
  PutActivityInPmPlan,
} from '../../screenplay/maintenance-management/pm-plan';
import {
  EnsureCoverageIs,
  EnsureCurrentStateIs,
  EnsureEquipmentWithoutAPlanAre,
  EnsureMostOverdueEquipmentAre,
  EnsurePerformanceIs,
  EnsureTheDashboardIsShown,
  EnsureTheDashboardWasNotShown,
  EnsureUpcomingWorkIs,
  EnsureUpcomingWorkIncludes,
  EnsureUpcomingWorkLeavesOut,
  ViewPmDashboard,
} from '../../screenplay/maintenance-management/pm-dashboard';
import {
  activeEquipmentOfWhichSomeArePlanned,
  forgetTheDashboardFixtures,
  occurrencesRecordedAsListed,
  onlyOneOccurrenceLeftUndone,
  pastOccurrencesInTheLastDays,
  theEquipmentLeftWithoutAPlan,
  theTodayTheScenarioStates,
} from '../../screenplay/maintenance-management/pm-dashboard-fixtures';

// technical-management-dashboard.feature (issue #89, «داشبورد مدیریتی فنی»). Door split
// (acceptance-tests/CLAUDE.md's table): every «… داشبورد مدیریتی فنی را … مشاهده می کند» opens
// `/pm-dashboard` in the browser, choosing «بازه زمانی» and «تجهیز» when the step names them (the
// page's default, «30 روز اخیر» and «همه تجهیزات», otherwise), and every `Then` reads that page.
// The «تلاش …» attempt is `GET pm-dashboard` over the API (403). Every `Given` is a precondition
// over the API, as the system admin, on the day it names (`asPersonaOn` — clock first, then log in).
//
// Reused, not redefined: the background («اینکه تجهیز … در سیستم ثبت شده باشد» and «امروز … باشد»
// in ./common.steps.ts; «… وارد سیستم شده باشد» and «پیغام خطای عدم دسترسی نشان داده شود» in
// step-definitions/common.steps.ts), «(اینکه) فعالیت … و اولین موعد … در برنامه تجهیز … باشد»
// (./common.steps.ts), «اینکه برنامه تجهیز … به صورت زیر باشد» and «انجام … ثبت شده باشد»
// (./daily-pm-schedule.steps.ts), «انجام … برای موعد … در … ثبت شده باشد»
// (./planning-preventive-maintenance.steps.ts), «اینکه تجهیزهای … و … در سیستم ثبت شده باشند»
// (./planning-preventive-maintenance.steps.ts) and «هیچ انجامی برای … ثبت نشده باشد»
// (./recording-maintenance-execution.steps.ts).
//
// «حذف» in this Gherkin is deactivation (issue #91): nothing is removed from a plan any more.

Before(({ pickle }) => {
  forgetTheDashboardFixtures(pickle.steps.map((step) => step.text));
});

// قانون: فقط مدیر فنی و مدیر سیستم مجاز به مشاهده داشبورد مدیریتی فنی هستند

When('{actor} داشبورد مدیریتی فنی را مشاهده می کند', (actor: Actor) =>
  actor.attemptsTo(ViewPmDashboard.using({})),
);

Then('داشبورد مدیریتی فنی به {actor} نشان داده شود', (actor: Actor) =>
  actor.attemptsTo(EnsureTheDashboardIsShown()),
);

When('{actor} تلاش می کند داشبورد مدیریتی فنی را مشاهده کند', (actor: Actor) =>
  actor.attemptsTo(ViewPmDashboard.viaApiUsing()),
);

Then('داشبورد مدیریتی فنی نمایش داده نشود', () =>
  actorInTheSpotlight().attemptsTo(EnsureTheDashboardWasNotShown()),
);

// قانون: کارهای سررسید امروز، عقب افتاده و انجام شده امروز وضعیت روز جاری را نشان می دهند و به بازه انتخاب شده بستگی ندارند

When(
  '{actor} داشبورد مدیریتی فنی را با بازه {string} مشاهده می کند',
  (actor: Actor, period: string) =>
    actor.attemptsTo(ViewPmDashboard.using({ period })),
);

Then('شاخص های وضعیت جاری به صورت زیر باشد', (table: DataTable) =>
  actorInTheSpotlight().attemptsTo(EnsureCurrentStateIs(table.hashes()[0])),
);

// قانون: موعدهای ازدست رفته بر اساس روزی شمرده می شوند که موعد در آن انجام نشده حساب شده است
//
// «… فقط موعد «…» بدون انجام مانده باشد» comes *before* the scenario's «امروز …», so the step looks
// ahead for it (`theTodayTheScenarioStates`, read off the pickle by the `Before` above) and records
// every other occurrence due before that day, each on its own due date.

Given(
  'از موعدهای {maintenanceTask} فقط موعد {string} بدون انجام مانده باشد',
  (maintenanceTask: string, undoneDueDate: string) =>
    onlyOneOccurrenceLeftUndone(
      maintenanceTask,
      undoneDueDate,
      theTodayTheScenarioStates(),
    ),
);

Then('تعداد موعدهای ازدست رفته {string} باشد', (count: string) =>
  actorInTheSpotlight().attemptsTo(
    EnsureCurrentStateIs({ 'موعدهای ازدست رفته': count }),
  ),
);

// قانون: درصد پایبندی سهم موعدهای گذشته ای است که بموقع انجام شده اند و درصد تکمیل سهم موعدهای گذشته ای است که بموقع یا با تاخیر انجام شده اند

Given(
  'اینکه در {int} روز اخیر موعد {int} کار گذشته باشد که {int} کار بموقع و {int} کار با تاخیر انجام شده و {int} کار انجام نشده باشد',
  (
    periodDays: number,
    total: number,
    onTime: number,
    late: number,
    notDone: number,
  ) =>
    pastOccurrencesInTheLastDays({
      periodDays,
      total,
      onTime,
      late,
      notDone,
    }),
);

Then(
  'درصد پایبندی {string} و درصد تکمیل {string} باشد',
  (adherence: string, completion: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsurePerformanceIs({
        'درصد پایبندی': adherence,
        'درصد تکمیل': completion,
      }),
    ),
);

Then('درصد پایبندی {string} باشد', (adherence: string) =>
  actorInTheSpotlight().attemptsTo(
    EnsurePerformanceIs({ 'درصد پایبندی': adherence }),
  ),
);

// «انجام موعدهای … به صورت زیر ثبت شده باشد» — each row recorded on its «روز انجام», landing on its
// «موعد». The older «انجام … ثبت شده باشد» (./daily-pm-schedule.steps.ts) is a regular expression
// that refuses «موعدهای …», or the two would be ambiguous.
Given(
  'انجام موعدهای {maintenanceTask} به صورت زیر ثبت شده باشد',
  (maintenanceTask: string, table: DataTable) =>
    occurrencesRecordedAsListed(
      maintenanceTask,
      table.hashes().map((row) => ({
        dueDate: row['موعد'],
        performedOn: row['روز انجام'],
      })),
    ),
);

Then('عملکرد به صورت زیر باشد', (table: DataTable) =>
  actorInTheSpotlight().attemptsTo(EnsurePerformanceIs(table.hashes()[0])),
);

// قانون: با انتخاب یک تجهیز، شاخص ها فقط برای همان تجهیز حساب می شوند

When(
  '{actor} داشبورد مدیریتی فنی را برای {string} با بازه {string} مشاهده می کند',
  (actor: Actor, equipment: string, period: string) =>
    actor.attemptsTo(ViewPmDashboard.using({ period, equipment })),
);

Then('تعداد کارهای عقب افتاده {string} باشد', (count: string) =>
  actorInTheSpotlight().attemptsTo(
    EnsureCurrentStateIs({ 'عقب افتاده': count }),
  ),
);

// قانون: سوابق فعالیت حذف شده یا تجهیز کنار گذاشته شده در عملکرد دوره های گذشته می ماند و موعدهای پس از آن شمرده نمی شوند

Given(
  'فعالیت {string} در {string} از برنامه تجهیز {string} حذف شده باشد',
  (activityName: string, date: string, equipmentName: string) =>
    asPersonaOn(
      'یاشار',
      date,
      DeactivateActivityInPmPlan.asAPrecondition(equipmentName, activityName),
    ),
);

Given(
  'تجهیز {string} در {string} کنار گذاشته شده باشد',
  (equipmentName: string, date: string) =>
    asPersonaOn('یاشار', date, RetireEquipment.viaApiUsing(equipmentName)),
);

Then('تعداد کارهای انجام شده بموقع {string} باشد', (count: string) =>
  actorInTheSpotlight().attemptsTo(
    EnsurePerformanceIs({ 'انجام شده بموقع': count }),
  ),
);

// قانون: تجهیز فعالی که دست کم یک فعالیت در برنامه دارد دارای برنامه است و تجهیزات کنار گذاشته شده در پوشش برنامه شمرده نمی شوند

Given(
  'فعالیت {string} با دوره {string} روز و اولین موعد {string} در برنامه تجهیزهای {string}، {string} و {string} باشد',
  (
    activityName: string,
    intervalDays: string,
    firstDueDate: string,
    first: string,
    second: string,
    third: string,
  ) =>
    asTheSystemAdmin(
      ...[first, second, third].map((equipmentName) =>
        PutActivityInPmPlan({
          equipmentName,
          activityName,
          intervalDays,
          firstDueDate,
        }),
      ),
    ),
);

Given(
  'فعالیت {string} از برنامه تجهیز {string} حذف شده باشد',
  (activityName: string, equipmentName: string) =>
    asTheSystemAdmin(
      DeactivateActivityInPmPlan.asAPrecondition(equipmentName, activityName),
    ),
);

const isRetired = (equipmentName: string) =>
  asTheSystemAdmin(RetireEquipment.viaApiUsing(equipmentName));

Given('اینکه تجهیز {string} کنار گذاشته شده باشد', isRetired);
Given('تجهیز {string} کنار گذاشته شده باشد', isRetired);

Then('پوشش برنامه PM به صورت زیر باشد', (table: DataTable) =>
  actorInTheSpotlight().attemptsTo(EnsureCoverageIs(table.hashes()[0])),
);

Then('تجهیزات فاقد برنامه فقط {string} باشد', (equipmentName: string) =>
  actorInTheSpotlight().attemptsTo(
    EnsureEquipmentWithoutAPlanAre([equipmentName]),
  ),
);

Given(
  'اینکه {int} تجهیز فعال در سیستم ثبت شده باشد که {int} تای آن ها فعالیتی در برنامه داشته باشند',
  (activeEquipment: number, withPlan: number) =>
    activeEquipmentOfWhichSomeArePlanned(activeEquipment, withPlan),
);

Then('فهرست تجهیزات فاقد برنامه همان {int} تجهیز باشد', (count: number) =>
  actorInTheSpotlight().attemptsTo(
    EnsureEquipmentWithoutAPlanAre(theEquipmentLeftWithoutAPlan(count)),
  ),
);

// قانون: تجهیزات به ترتیب تعداد کارهای عقب افتاده فعلی و در صورت برابری به ترتیب جمع روزهای تاخیر آن ها می آیند

Given('برنامه تجهیزات به صورت زیر باشد', (table: DataTable) =>
  asTheSystemAdmin(
    ...table.hashes().map((row) =>
      PutActivityInPmPlan({
        equipmentName: row['تجهیز'],
        activityName: row['فعالیت'],
        intervalDays: row['دوره (روز)'],
        firstDueDate: row['اولین موعد'],
      }),
    ),
  ),
);

Then(
  'تجهیزات دارای بیشترین عقب افتادگی به ترتیب زیر باشند',
  (table: DataTable) =>
    actorInTheSpotlight().attemptsTo(
      EnsureMostOverdueEquipmentAre(table.hashes()),
    ),
);

// قانون: برنامه هفت روز آینده موعدهای فردا تا هفت روز بعد را که هنوز انجامشان ثبت نشده به ترتیب موعد نشان می دهد

Then('برنامه هفت روز آینده به صورت زیر باشد', (table: DataTable) =>
  actorInTheSpotlight().attemptsTo(EnsureUpcomingWorkIs(table.hashes())),
);

Then(
  '{maintenanceTask} در برنامه هفت روز آینده نباشد',
  (maintenanceTask: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureUpcomingWorkLeavesOut(maintenanceTask),
    ),
);

Then(
  '{maintenanceTask} با موعد {string} در برنامه هفت روز آینده باشد',
  (maintenanceTask: string, dueDate: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureUpcomingWorkIncludes(maintenanceTask, dueDate),
    ),
);
