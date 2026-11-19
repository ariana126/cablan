import { Before, DataTable, Given, Then, When } from '@cucumber/cucumber';
import { Actor, actorInTheSpotlight } from '@serenity-js/core';
import { asTheSystemAdmin } from '../../screenplay/maintenance-management/maintenance-records';
import {
  EnsureActivityIsActiveInPmPlanWith,
  EnsureActivityIsActiveInPmPlanOnlyOnce,
} from '../../screenplay/maintenance-management/pm-plan';
import {
  EnsureNoPlanItemWasAdded,
  EnsurePmPlanImportShowsTheErrors,
  EnsurePmPlanImportShowsAnError,
  EnsurePmPlanImportReportsAConflict,
  EnsurePmPlanImportReportsAlreadyExisting,
  EnsureToldHowManyPlanItemsCanBeAdded,
  forgetThePmPlanSheets,
  ImportPmPlanExcel,
  importAsAPrecondition,
  thePmPlanSheetLastUploaded,
  UploadPmPlanExcel,
  uploadWithAnUndefinedActivityAsAPrecondition,
} from '../../screenplay/maintenance-management/pm-plan-import';
import {
  aPmPlanSheetHolding,
  aValidPmPlanSheet,
  pmPlanSheetFrom,
} from '../../screenplay/maintenance-management/pm-plan-excel';
import { statementsAboutPmPlansAre } from '../../screenplay/common/pm-plan-statement-context';

// importing-pm-plans.feature (issue #127). Doors (acceptance-tests/CLAUDE.md): the active
// «… بارگذاری (و تایید) می کند» `When`s upload a real `.xlsx` through `/pm-plans`' «بارگذاری از
// اکسل» and read the check dialog it opens; the «تلاش …» outline and the passive preconditions go
// through `POST pm-plan-imports[/preview]`. What the import *reported* is read off that dialog; what
// it *did* to the plans is read over the API by یاشار (`asTheSystemAdmin`), so a refused actor's 403
// survives for «پیغام خطای عدم دسترسی …».
//
// Reused, defined elsewhere: the background («اینکه تجهیزهای … و … در سیستم ثبت شده باشند», «فعالیت
// های … و … در سیستم ثبت شده باشند» — ./planning-preventive-maintenance.steps.ts; «یاشار وارد سیستم
// شده باشد» — step-definitions/common.steps.ts), «(اینکه) فعالیت … با دوره … روز و اولین موعد … در
// برنامه تجهیز … باشد» (./common.steps.ts — a precondition before an upload, an outcome after one:
// exactly one active row with those values, read over the API; every step below sets
// `common/pm-plan-statement-context.ts` explicitly, an upload to `outcome`, a precondition to
// `precondition`), «موعدهای بعدی … و … باشند», «فقط فعالیت … در
// برنامه فعال تجهیز … باشد» (./planning-preventive-maintenance.steps.ts), «هیچ انجامی برای … ثبت
// نشده باشد» (./recording-maintenance-execution.steps.ts — «X و Y» names several tasks), «هیچ
// فعالیتی در برنامه تجهیز … نباشد» (./registring-equipment.steps.ts), «اینکه تجهیز … کنار گذاشته شده
// باشد» (./technical-management-dashboard.steps.ts), «اینکه … وارد سیستم شده باشد» and «پیغام خطای
// عدم دسترسی نشان داده شود» (step-definitions/common.steps.ts).

Before(() => {
  forgetThePmPlanSheets();
});

// The active `When`s — the browser.

When(
  '{actor} اکسل برنامه PM زیر را بارگذاری و تایید می کند',
  (actor: Actor, table: DataTable) => {
    statementsAboutPmPlansAre('outcome');
    return actor.attemptsTo(
      ImportPmPlanExcel.using(pmPlanSheetFrom(table.raw())),
    );
  },
);

When(
  '{actor} اکسل برنامه PM زیر را بارگذاری می کند',
  (actor: Actor, table: DataTable) => {
    statementsAboutPmPlansAre('outcome');
    return actor.attemptsTo(
      UploadPmPlanExcel.using(pmPlanSheetFrom(table.raw())),
    );
  },
);

When(
  '{actor} اکسل برنامه PM ای را بارگذاری می کند که {word} آن {string} است',
  (actor: Actor, cell: string, value: string) => {
    statementsAboutPmPlansAre('outcome');
    return actor.attemptsTo(
      UploadPmPlanExcel.using(aValidPmPlanSheet().withCell(cell, value)),
    );
  },
);

When('{actor} همان اکسل را دوباره بارگذاری و تایید می کند', (actor: Actor) => {
  statementsAboutPmPlansAre('outcome');
  return actor.attemptsTo(
    ImportPmPlanExcel.using(thePmPlanSheetLastUploaded()),
  );
});

// قانون: فقط مدیر سیستم مجاز به بارگذاری گروهی برنامه PM از اکسل است — the backend's 403, over HTTP.
// The attempt is the confirming upload (`POST pm-plan-imports`), the one that would add something.
When(
  '{actor} تلاش می کند اکسل برنامه PM ای را بارگذاری کند که {maintenanceTask} را دارد',
  (actor: Actor, maintenanceTask: string) => {
    statementsAboutPmPlansAre('outcome');
    return actor.attemptsTo(
      ImportPmPlanExcel.viaApiUsing(aPmPlanSheetHolding(maintenanceTask)),
    );
  },
);

// The passive preconditions — the API, as the persona named, the spotlight left where it was.

Given(
  'اینکه {actorName} اکسل برنامه PM ای بارگذاری کرده باشد که فعالیت {string} آن تعریف نشده است',
  (importerName: string, activityName: string) => {
    statementsAboutPmPlansAre('precondition');
    return uploadWithAnUndefinedActivityAsAPrecondition(
      importerName,
      activityName,
    );
  },
);

Given(
  'اینکه {actorName} اکسل برنامه PM زیر را بارگذاری و تایید کرده باشد',
  (importerName: string, table: DataTable) => {
    statementsAboutPmPlansAre('precondition');
    return importAsAPrecondition(importerName, pmPlanSheetFrom(table.raw()));
  },
);

// What the import reported — off the dialog the actor's upload left open.

Then('به او گفته شود که {int} برنامه قابل ثبت است', (count: number) =>
  actorInTheSpotlight().attemptsTo(EnsureToldHowManyPlanItemsCanBeAdded(count)),
);

Then('خطاهای زیر نشان داده شوند', (table: DataTable) =>
  actorInTheSpotlight().attemptsTo(
    EnsurePmPlanImportShowsTheErrors(
      table.hashes().map((row) => ({
        cell: row['خانه'],
        value: row['مقدار'],
        reason: row['علت'],
      })),
    ),
  ),
);

Then(
  'خطای {string} برای خانه {word} با مقدار {string} نشان داده شود',
  (reason: string, cell: string, value: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsurePmPlanImportShowsAnError({ reason, cell, value }),
    ),
);

Then(
  'خطای {string} برای خانه {word} نشان داده شود',
  (reason: string, cell: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsurePmPlanImportShowsAnError({ reason, cell }),
    ),
);

Then(
  'خطای {string} برای خانه های {word} و {word} نشان داده شود',
  (reason: string, first: string, second: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsurePmPlanImportShowsAnError({ reason, cell: first }),
      EnsurePmPlanImportShowsAnError({ reason, cell: second }),
    ),
);

Then('{maintenanceTask} "از قبل موجود" گزارش شود', (maintenanceTask: string) =>
  actorInTheSpotlight().attemptsTo(
    EnsurePmPlanImportReportsAlreadyExisting(maintenanceTask),
  ),
);

// «<مورد>» is «دوره» or the two-word «اولین موعد», which a Cucumber-expression alternative cannot
// hold — hence one definition each.
Then('اختلاف دوره {maintenanceTask} گزارش شود', (maintenanceTask: string) =>
  actorInTheSpotlight().attemptsTo(
    EnsurePmPlanImportReportsAConflict(maintenanceTask, ['intervalDays']),
  ),
);

Then(
  'اختلاف اولین موعد {maintenanceTask} گزارش شود',
  (maintenanceTask: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsurePmPlanImportReportsAConflict(maintenanceTask, ['firstDueDate']),
    ),
);

// What the import did to the plans — over the API, as یاشار.

Then('هیچ برنامه ای ثبت نشده باشد', () =>
  asTheSystemAdmin(EnsureNoPlanItemWasAdded()),
);

Then(
  'فعالیت {string} با دوره {string} روز و اولین موعد {string} همچنان در برنامه فعال تجهیز {string} باشد',
  (
    activityName: string,
    intervalDays: string,
    firstDueDate: string,
    equipmentName: string,
  ) =>
    asTheSystemAdmin(
      EnsureActivityIsActiveInPmPlanWith(
        equipmentName,
        activityName,
        intervalDays,
        firstDueDate,
      ),
    ),
);

Then(
  'فعالیت {string} فقط یک بار در برنامه فعال تجهیز {string} باشد',
  (activityName: string, equipmentName: string) =>
    asTheSystemAdmin(
      EnsureActivityIsActiveInPmPlanOnlyOnce(equipmentName, activityName),
    ),
);
