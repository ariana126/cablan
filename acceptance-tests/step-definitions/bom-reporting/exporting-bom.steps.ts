import { Given, When, Then, DataTable } from '@cucumber/cucumber';
import {
  Actor,
  actorCalled,
  actorInTheSpotlight,
  Task,
} from '@serenity-js/core';
import {
  AttemptToViewBomReportListWithoutLoggingIn,
  anonymousVisitorActorName,
  ViewBomReportList,
} from '../../screenplay/bom-reporting/bom-report-list';
import {
  EnsureExportedDailyBomCellsAre,
  EnsureExportedDailyBomRowsAre,
  ExportDailyBomReportList,
} from '../../screenplay/bom-reporting/bom-report-export';
import {
  MakeStandardBomMaterialWeightsTotal,
  RegisterDailyBomWithOneMaterialWeighing,
  RegisterStandardBomWithMaterialWeightTotal,
} from '../../screenplay/bom-reporting/bom-report-weight-totals';
import { LogInAsPersona } from '../../screenplay/common/personas';
import {
  correctAndApproveDailyBomAsAPrecondition,
  theDailyBomWithOrderNumber,
} from '../../screenplay/bom-analyzing/daily-bom-approval';

// The Then steps this feature shares with exporting-standard-bom.feature — none of them
// mention "روزانه" — are defined once in bom-reporting/common.steps.ts. The rejection precondition
// "اینکه آنالیز روزانه با شماره سفارش ... توسط ... با دلیل ... عدم تایید شده باشد" is shared with
// approving-bom and reporting-bom, and defined in step-definitions/common.steps.ts.

const splitValues = (csv: string): string[] =>
  csv.split(',').map((value) => value.trim());

/**
 * "قانون: فقط کاربر وارد شده به سیستم مجاز به خروجی گرفتن از لیست آنالیز های روزانه است" — the
 * report page's export controls sit behind the same route guard as the list itself
 * (`reporting-bom.feature`'s own "تلاش برای مشاهده لیست بدون ورود به سیستم"), so attempting to
 * reach them anonymously is exactly `AttemptToViewBomReportListWithoutLoggingIn` — there is no
 * separate "export" route to distinguish from the list's own. Same anonymous-actor mechanics as
 * `reporting-bom.steps.ts`'s own equivalent (`anonymousVisitorActorName` moves the spotlight so the
 * shared, bare "از او خواسته شود وارد سیستم شود" `Then` — `step-definitions/common.steps.ts` —
 * reads ITS page state).
 */
When(
  'کاربری که وارد سیستم نشده تلاش می کند از لیست آنالیز های روزانه خروجی اکسل بگیرد',
  () =>
    actorCalled(anonymousVisitorActorName).attemptsTo(
      AttemptToViewBomReportListWithoutLoggingIn(),
    ),
);

When(
  '{actor} از لیست آنالیز های روزانه با فرمت {string} خروجی اکسل می گیرد',
  (actor: Actor, format: string) =>
    actor.attemptsTo(ExportDailyBomReportList.usingFormat(format)),
);

Given(
  'اینکه {actor} لیست آنالیز های روزانه را با انتخاب مقادیر {string} برای فیلتر {string} مشاهده کرده باشد',
  (actor: Actor, valuesCsv: string, field: string) =>
    actor.attemptsTo(
      ViewBomReportList.filteredBySelectingValuesFor(
        field,
        splitValues(valuesCsv),
      ),
    ),
);

// The management note's own rule: the reviewer corrects a weight while reviewing, then approves —
// through the API, as a precondition, so the export is what the scenario looks at.
Given(
  'اینکه {actorName} وزن مواد اولیه {string} جز {string} آنالیز روزانه با شماره سفارش {string} را به {string} تغییر داده و سپس آن را تایید کرده باشد',
  (
    reviewerName: string,
    materialName: string,
    componentName: string,
    orderNumber: string,
    weight: string,
  ) =>
    correctAndApproveDailyBomAsAPrecondition(
      theDailyBomWithOrderNumber(orderNumber),
      reviewerName,
      [{ componentName, materialName, weight: Number(weight) }],
    ),
);

Then(
  'آنالیز روزانه با شماره سفارش {string} در فایل اکسل خروجی به صورت زیر باشد',
  (orderNumber: string, table: DataTable) =>
    actorInTheSpotlight().attemptsTo(
      EnsureExportedDailyBomRowsAre(orderNumber, table.raw()),
    ),
);

// The weight-total rules (وزن 1 متر، وزن متراژ استاندارد، اختلاف با استاندارد). Their preconditions
// are passive, so they go through the API as یاشار — who logs in afresh, since the background's
// clock freezes can outlive his earlier token. The When that follows names سینا and takes the
// spotlight back.
const asTheSystemAdmin = (task: Task) =>
  actorCalled('یاشار').attemptsTo(LogInAsPersona('یاشار'), task);

const standardBomMaterialWeightsTotal = (miCode: string, total: number) =>
  asTheSystemAdmin(MakeStandardBomMaterialWeightsTotal(miCode, total));

Given(
  'اینکه آنالیز استاندارد با کد MI {string} با مجموع وزن مواد اولیه {float} در سیستم ثبت شده باشد',
  standardBomMaterialWeightsTotal,
);

Given(
  'آنالیز استاندارد با کد MI {string} با مجموع وزن مواد اولیه {float} در سیستم ثبت شده باشد',
  standardBomMaterialWeightsTotal,
);

Given(
  'اینکه آنالیز استاندارد با کد MI {string} و متراژ استاندارد {int} با مجموع وزن مواد اولیه {float} در سیستم ثبت شده باشد',
  (miCode: string, standardLength: number, total: number) =>
    asTheSystemAdmin(
      RegisterStandardBomWithMaterialWeightTotal(miCode, standardLength, total),
    ),
);

Given(
  'آنالیز روزانه با شماره سفارش {string} برای کد MI {string} با یک مواد اولیه به وزن {float} در سیستم ثبت شده باشد',
  (orderNumber: string, miCode: string, weight: number) =>
    asTheSystemAdmin(
      RegisterDailyBomWithOneMaterialWeighing(orderNumber, miCode, weight),
    ),
);

const WEIGHT_PER_METER = 'وزن 1 متر';
const STANDARD_LENGTH_WEIGHT = 'وزن متراژ استاندارد';
const DIFFERENCE_FROM_STANDARD = 'اختلاف با استاندارد';

Then(
  'در فایل اکسل خروجی برای آنالیز روزانه با شماره سفارش {string} وزن 1 متر {string} و وزن متراژ استاندارد {string} باشد',
  (orderNumber: string, weightPerMeter: string, standardLengthWeight: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureExportedDailyBomCellsAre(orderNumber, {
        [WEIGHT_PER_METER]: weightPerMeter,
        [STANDARD_LENGTH_WEIGHT]: standardLengthWeight,
      }),
    ),
);

Then(
  'در فایل اکسل خروجی برای آنالیز روزانه با شماره سفارش {string} اختلاف با استاندارد {string} باشد',
  (orderNumber: string, difference: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureExportedDailyBomCellsAre(orderNumber, {
        [DIFFERENCE_FROM_STANDARD]: difference,
      }),
    ),
);

// One header row and one value row; each header names a column of the exported row.
Then(
  'در فایل اکسل خروجی برای آنالیز روزانه با شماره سفارش {string} مقادیر زیر باشد',
  (orderNumber: string, table: DataTable) =>
    actorInTheSpotlight().attemptsTo(
      EnsureExportedDailyBomCellsAre(orderNumber, table.hashes()[0]),
    ),
);
