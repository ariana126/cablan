import { Given, When } from '@cucumber/cucumber';
import { Actor, actorCalled } from '@serenity-js/core';
import {
  AttemptToViewStandardBomReportListWithoutLoggingIn,
  anonymousVisitorActorName,
  ViewStandardBomReportList,
} from '../../screenplay/bom-reporting/standard-bom-report-list';
import { ExportStandardBomReportList } from '../../screenplay/bom-reporting/standard-bom-report-export';

// The Then steps this feature shares with exporting-bom.feature — none of them mention
// "استاندارد" — are defined once in bom-reporting/common.steps.ts.

const splitValues = (csv: string): string[] =>
  csv.split(',').map((value) => value.trim());

/**
 * "قانون: فقط کاربر وارد شده به سیستم مجاز به خروجی گرفتن از لیست آنالیز های استاندارد است" — the
 * report page's export controls sit behind the same route guard as the list itself
 * (`reporting-standard-bom.feature`'s own `AttemptToViewStandardBomReportListWithoutLoggingIn`), so
 * attempting to reach them anonymously is exactly that task — there is no separate "export" route
 * to distinguish from the list's own. Mirrors `exporting-bom.steps.ts`'s own equivalent exactly:
 * `anonymousVisitorActorName` moves the spotlight so the shared, bare "از او خواسته شود وارد سیستم
 * شود" `Then` (`step-definitions/common.steps.ts`) reads ITS page state.
 */
When(
  'کاربری که وارد سیستم نشده تلاش می کند از لیست آنالیز های استاندارد خروجی اکسل بگیرد',
  () =>
    actorCalled(anonymousVisitorActorName).attemptsTo(
      AttemptToViewStandardBomReportListWithoutLoggingIn(),
    ),
);

When(
  '{actor} از لیست آنالیز های استاندارد با فرمت {string} خروجی اکسل می گیرد',
  (actor: Actor, format: string) =>
    actor.attemptsTo(ExportStandardBomReportList.usingFormat(format)),
);

Given(
  'اینکه {actor} لیست آنالیز های استاندارد را با انتخاب مقادیر {string} برای فیلتر {string} مشاهده کرده باشد',
  (actor: Actor, valuesCsv: string, field: string) =>
    actor.attemptsTo(
      ViewStandardBomReportList.filteredBySelectingValuesFor(
        field,
        splitValues(valuesCsv),
      ),
    ),
);
