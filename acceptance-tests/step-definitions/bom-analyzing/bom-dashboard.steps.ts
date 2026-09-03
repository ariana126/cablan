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
  EnsureDailyBomsWithOrderNumbersShown,
  OpenProductDailyBomList,
  OpenThatDailyBomListInTheDashboard,
} from '../../screenplay/bom-analyzing/bom-dashboard-product-details';
import { theProductRegisteredWithName } from '../../screenplay/bom-registration/product-details';
import { toPersianDigits } from '../../screenplay/common/persian-digits';

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

When('{actor} آن آنالیز روزانه را در داشبورد مشاهده می کند', (actor: Actor) => {
  // The score-visibility rule's `Given` registers a fresh product whose name is derived
  // from the rule's MI code ("محصول تست {MI code}"), but the Gherkin `When` step doesn't
  // name that product — it just says "that daily BOM in the dashboard". Looking the product
  // up by the exact name the `Given` (in `bom-dashboard-fixtures.steps.ts`) registered it
  // under is what keeps this step decoupled from the rule's specific values.
  const product = theProductRegisteredWithName('محصول تست 2001');
  return actor.attemptsTo(OpenThatDailyBomListInTheDashboard(product.name));
});

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
  'آنالیز های روزانه با شماره سفارش {string} برای آن محصول نمایش داده شود',
  (orderNumbersCsv: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureDailyBomsWithOrderNumbersShown(
        'کابل شبکه U/UTP 0.42 LEGRAND',
        splitValues(orderNumbersCsv),
      ),
    ),
);

Then('لیست شامل موارد زیر باشد', (table: DataTable) => {
  // `actualWeight` is a quantity, rendered through the `persianNumber` pipe
  // (`bom-dashboard-page.html`'s per-line table), so the Gherkin's Latin-digit literal has to be
  // converted before it can match — see `screenplay/common/persian-digits.ts`. `description` stays
  // untouched: it's free text, not a quantity, and keeps whatever digits it was given verbatim.
  const lines: DailyBomLine[] = table.hashes().map((row) => ({
    componentName: row['نام جز'],
    materialName: row['نام مواد اولیه'],
    actualWeight: toPersianDigits(row['وزن مواد اولیه']),
    description: row['توضیحات'] === '-' ? '—' : row['توضیحات'],
  }));
  return actorInTheSpotlight().attemptsTo(
    EnsureDailyBomLinesAreExactly('کابل شبکه U/UTP 0.42 LEGRAND', lines),
  );
});

// The score cell is `persianNumber`-piped like the per-line weights above, so the same digit
// conversion applies before comparing.
Then('امتیاز آن آنالیز روزانه برابر {string} نمایش داده شود', (score: string) =>
  actorInTheSpotlight().attemptsTo(
    EnsureDailyBomScoreIs('محصول تست 2001', toPersianDigits(score)),
  ),
);

Then(
  'آنالیز های روزانه به ترتیب زیر بر اساس امتیاز نمایش داده شود',
  (table: DataTable) => {
    // The Gherkin table has a header row "شماره سفارش" + "امتیاز" and one column per data row;
    // the per-product ordering rule's `Then` step only asserts the order numbers (the score
    // column is informational, since the per-product panel already renders them in score-desc
    // order, which the order-number cells' own order is what proves).
    const orderNumbers = table.rows().map((row) => row[0]);
    return actorInTheSpotlight().attemptsTo(
      EnsureDailyBomsShownInOrder('کابل شبکه U/UTP 0.42 LEGRAND', orderNumbers),
    );
  },
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
