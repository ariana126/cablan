import { Given, When } from '@cucumber/cucumber';
import { Actor, actorCalled } from '@serenity-js/core';
import {
  AttemptToViewBomReportListWithoutLoggingIn,
  anonymousVisitorActorName,
  ViewBomReportList,
} from '../../screenplay/bom-reporting/bom-report-list';
import { ExportDailyBomReportList } from '../../screenplay/bom-reporting/bom-report-export';

// The Then steps this feature shares with exporting-standard-bom.feature — none of them
// mention "روزانه" — are defined once in bom-reporting/common.steps.ts.

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
