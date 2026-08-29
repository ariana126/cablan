import { When, Then, DataTable } from '@cucumber/cucumber';
import { Actor, actorCalled, actorInTheSpotlight } from '@serenity-js/core';
import {
  AttemptToViewStandardBomReportListWithoutLoggingIn,
  anonymousVisitorActorName,
  EnsureAllRegisteredStandardBomsAreShown,
  EnsureOnlyStandardBomsWithMiCodesShown,
  EnsureStandardBomsShownInOrder,
  ViewStandardBomReportList,
} from '../../screenplay/bom-reporting/standard-bom-report-list';
import { OpenStandardBomReportDetails } from '../../screenplay/bom-reporting/standard-bom-report-details';
import { theBackgroundMiCodes } from '../../screenplay/bom-reporting/standard-bom-report-fixtures';

const splitValues = (csv: string): string[] =>
  csv.split(',').map((value) => value.trim());

When(
  '{actor} لیست آنالیز های استاندارد را بدون فیلتر مشاهده می کند',
  (actor: Actor) => actor.attemptsTo(ViewStandardBomReportList.unfiltered()),
);

Then('تمام آنالیز های استاندارد ثبت شده نمایش داده شود', () =>
  actorInTheSpotlight().attemptsTo(
    EnsureAllRegisteredStandardBomsAreShown(theBackgroundMiCodes()),
  ),
);

Then(
  'فقط آنالیز های استاندارد با کد MI {string} نمایش داده شود',
  (miCodesCsv: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureOnlyStandardBomsWithMiCodesShown(miCodesCsv),
    ),
);

Then('آنالیز های استاندارد به ترتیب زیر نمایش داده شود', (table: DataTable) =>
  actorInTheSpotlight().attemptsTo(
    EnsureStandardBomsShownInOrder(table.rows().map((row) => row[0])),
  ),
);

// Sorting: default order is ascending by product name (already established by unfiltered view)
// "ترتیب معکوس" — reverse to descending
When(
  '{actor} ترتیب مرتب سازی لیست آنالیز های استاندارد بر اساس نام محصول را معکوس می کند',
  (actor: Actor) =>
    actor.attemptsTo(ViewStandardBomReportList.sortedByProductNameDesc()),
);

When(
  '{actor} جزئیات آنالیز استاندارد با کد MI {string} را باز می کند',
  (actor: Actor, miCode: string) =>
    actor.attemptsTo(OpenStandardBomReportDetails(miCode)),
);

When(
  '{actor} لیست آنالیز های استاندارد را با انتخاب مقادیر {string} برای فیلتر {string} مشاهده می کند',
  (actor: Actor, valuesCsv: string, field: string) =>
    actor.attemptsTo(
      ViewStandardBomReportList.filteredBySelectingValuesFor(
        field,
        splitValues(valuesCsv),
      ),
    ),
);

When(
  '{actor} لیست آنالیز های استاندارد را با انتخاب مقادیر زیر مشاهده می کند',
  (actor: Actor, table: DataTable) => {
    const filters = table.hashes().map((row) => ({
      field: row['فیلد'],
      values: splitValues(row['مقادیر انتخاب شده']),
    }));
    return actor.attemptsTo(
      ViewStandardBomReportList.filteredByCombination(filters),
    );
  },
);

When(
  '{actor} لیست آنالیز های استاندارد را با عدم انتخاب مقدار {string} برای فیلتر {string} مشاهده می کند',
  (actor: Actor, value: string, field: string) =>
    actor.attemptsTo(
      ViewStandardBomReportList.withValueDeselectedFor(field, value),
    ),
);

When(
  '{actor} لیست آنالیز های استاندارد را با عدم انتخاب همه مقادیر فیلتر {string} مشاهده می کند',
  (actor: Actor, field: string) =>
    actor.attemptsTo(
      ViewStandardBomReportList.withAllValuesDeselectedFor(field),
    ),
);

When('{actor} لیست آنالیز های استاندارد را مشاهده می کند', (actor: Actor) =>
  actor.attemptsTo(ViewStandardBomReportList.unfiltered()),
);

// Steps shared with reporting-bom.feature live in step-definitions/bom-reporting/common.steps.ts,
// which dispatches on `currentReportKind()` from the `Given` that established the background.
// Defining them here would be ambiguous and fails the build.

// Auth rule: anonymous access attempt — standard-BOM-only, no shared counterpart.
When(
  'کاربری که وارد سیستم نشده تلاش می کند لیست آنالیز های استاندارد را مشاهده کند',
  () =>
    actorCalled(anonymousVisitorActorName).attemptsTo(
      AttemptToViewStandardBomReportListWithoutLoggingIn(),
    ),
);
