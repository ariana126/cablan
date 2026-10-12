import { When, Then, DataTable } from '@cucumber/cucumber';
import { Actor, actorCalled, actorInTheSpotlight } from '@serenity-js/core';
import {
  AttemptToViewBomDashboardWithoutLoggingIn,
  EnsureProductListIsExactly,
  ViewBomDashboard,
  anonymousVisitorActorName,
} from '../../screenplay/bom-analyzing/bom-dashboard-list';
import {
  DailyBomLine,
  EnsureDailyBomLinesAreExactly,
  EnsureDailyBomScoreIs,
  EnsureDailyBomsShownInOrder,
  EnsureDailyBomsWithTrackingNumbersShown,
  EnsureWeightDifferenceIs,
  OpenProductDailyBomList,
  OpenThatDailyBomListInTheDashboard,
} from '../../screenplay/bom-analyzing/bom-dashboard-product-details';
import { theLastRegisteredProduct } from '../../screenplay/bom-registration/product-details';

const splitValues = (csv: string): string[] =>
  csv.split(',').map((value) => value.trim());

When(
  '{actor} داشبورد آنالیز های روزانه را بدون فیلتر مشاهده می کند',
  (actor: Actor) => actor.attemptsTo(ViewBomDashboard.unfiltered()),
);

When(
  '{actor} داشبورد آنالیز های روزانه را با تاریخ و زمان ثبت بین {string} و {string} مشاهده می کند',
  (actor: Actor, from: string, to: string) =>
    actor.attemptsTo(ViewBomDashboard.filteredByDateRangeBetween(from, to)),
);

When(
  '{actor} محصول {string} را از داشبورد با بازه زمانی امروز انتخاب می کند',
  (actor: Actor, productName: string) =>
    actor.attemptsTo(OpenProductDailyBomList(productName)),
);

// The single-analysis rules' `Given` (`bom-dashboard-fixtures.steps.ts`) registers a fresh product
// named after its MI code, and neither this `When` nor the `Then`s after it name that product — they
// say "that daily BOM". The product that `Given` registered last is the one they mean.
When('{actor} آن آنالیز روزانه را در داشبورد مشاهده می کند', (actor: Actor) =>
  actor.attemptsTo(
    OpenThatDailyBomListInTheDashboard(theLastRegisteredProduct().name),
  ),
);

Then('تمام محصولات دارای آنالیز روزانه نمایش داده شود', () =>
  actorInTheSpotlight().attemptsTo(
    EnsureProductListIsExactly([
      'کابل شبکه U/UTP 0.42 LEGRAND',
      'کابل برق NYY 3x2.5',
      'کابل شبکه SFTP CAT6',
    ]),
  ),
);

Then('لیست محصولات زیر نمایش داده شود', (table: DataTable) =>
  actorInTheSpotlight().attemptsTo(
    EnsureProductListIsExactly(table.rows().map((row) => row[0])),
  ),
);

// "فهرست خالی نمایش داده شود" is owned by `step-definitions/common.steps.ts`'s shared
// page-agnostic step (`EnsureListIsEmpty`); no per-feature override here. The dashboard page
// renders a `mat-table` for its product list, so the shared step's own `.mat-mdc-row` count
// works for the empty-range example as-is.

Then(
  'آنالیز های روزانه با شماره ردیابی {string} برای آن محصول نمایش داده شود',
  (trackingNumbersCsv: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureDailyBomsWithTrackingNumbersShown(
        'کابل شبکه U/UTP 0.42 LEGRAND',
        splitValues(trackingNumbersCsv),
      ),
    ),
);

// Quantities are compared as the Gherkin writes them ("2", "-1.5"): the questions bring the
// rendered Persian numbers back to that notation (`screenplay/common/persian-digits.ts#
// fromRenderedNumber`). The description is free text and is compared verbatim, "-" standing for
// the em dash the page shows for an empty one.
Then('لیست شامل موارد زیر باشد', (table: DataTable) => {
  const lines: DailyBomLine[] = table.hashes().map((row) => ({
    trackingNumber: row['شماره ردیابی'],
    componentName: row['نام جز'],
    materialName: row['نام مواد اولیه'],
    standardWeight: row['وزن استاندارد مواد اولیه'],
    actualWeight: row['وزن مواد اولیه'],
    difference: row['اختلاف وزن'],
    description: row['توضیحات'] === '-' ? '—' : row['توضیحات'],
  }));
  return actorInTheSpotlight().attemptsTo(
    EnsureDailyBomLinesAreExactly('کابل شبکه U/UTP 0.42 LEGRAND', lines),
  );
});

Then(
  'اختلاف وزن مواد اولیه {string} جز {string} برابر {string} نمایش داده شود',
  (materialName: string, componentName: string, difference: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureWeightDifferenceIs(
        theLastRegisteredProduct().name,
        componentName,
        materialName,
        difference,
      ),
    ),
);

Then('امتیاز آن آنالیز روزانه برابر {string} نمایش داده شود', (score: string) =>
  actorInTheSpotlight().attemptsTo(
    EnsureDailyBomScoreIs(theLastRegisteredProduct().name, score),
  ),
);

Then(
  'آنالیز های روزانه به ترتیب زیر بر اساس امتیاز نمایش داده شود',
  (table: DataTable) =>
    // Only the tracking-number column is asserted: the rendered order of the tracking numbers is
    // what proves the score-desc ordering; the score column documents why that order is right.
    actorInTheSpotlight().attemptsTo(
      EnsureDailyBomsShownInOrder(
        'کابل شبکه U/UTP 0.42 LEGRAND',
        table.rows().map((row) => row[0]),
      ),
    ),
);

// "قانون: فقط کاربر وارد سیستم مجاز به مشاهده داشبورد آنالیز های روزانه است" — no {actor} in
// the step text itself: this is an anonymous visitor who was never part of the background's
// own "نیکروش وارد سیستم شده باشد" login, so it acts as its own fixed identity
// (`anonymousVisitorActorName`), the same way `bom-report-list.ts#anonymousVisitorActorName`
// does for that feature's anonymous login attempts. `actorCalled(...)` moves the spotlight
// onto it, which is what lets the shared, bare "از او خواسته شود وارد سیستم شود" Then
// (`step-definitions/common.steps.ts`) read ITS page state rather than نیکروش's.
When(
  'کاربری که وارد سیستم نشده تلاش می کند داشبورد آنالیز های روزانه را مشاهده کند',
  () =>
    actorCalled(anonymousVisitorActorName).attemptsTo(
      AttemptToViewBomDashboardWithoutLoggingIn(),
    ),
);
