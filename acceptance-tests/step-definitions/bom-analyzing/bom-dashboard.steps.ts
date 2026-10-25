import { Given, When, Then, DataTable } from '@cucumber/cucumber';
import { Actor, actorCalled, actorInTheSpotlight } from '@serenity-js/core';
import {
  ApprovalFilter,
  AttemptToViewBomDashboardWithoutLoggingIn,
  EnsureProductListIsExactly,
  HaveViewedBomDashboardEarlier,
  ViewBomDashboard,
  anonymousVisitorActorName,
} from '../../screenplay/bom-analyzing/bom-dashboard-list';
import {
  ChangeDailyBomDescription,
  ChangeMaterialWeight,
  DailyBomLine,
  EnsureDailyBomLinesAreExactly,
  EnsureDailyBomScoreIs,
  EnsureDailyBomsRankedByScore,
  EnsureDailyBomsWithOrderNumbersShown,
  EnsureTheDashboardNoLongerShowsThatDailyBom,
  EnsureTheDashboardScoreIs,
  EnsureTheDashboardShowsDescription,
  EnsureTheDashboardShowsTheReview,
  EnsureWeightDifferenceIs,
  OpenProductDailyBomList,
  OpenThatDailyBomListInTheDashboard,
  theProductInFocusOnTheDashboard,
} from '../../screenplay/bom-analyzing/bom-dashboard-product-details';
import {
  ApproveDailyBom,
  RejectDailyBom,
} from '../../screenplay/bom-analyzing/daily-bom-approval';
import { withLatinDigits } from '../../screenplay/common/persian-digits';
import { realNameFor } from '../../screenplay/common/personas';
import {
  theLastRegisteredProduct,
  theProductRegisteredWithName,
} from '../../screenplay/bom-registration/product-details';

/** A comma-separated cell as a list; an empty cell is an empty list (the outline's «عدم تایید»
 * example that expects no product at all). */
const splitValues = (csv: string): string[] =>
  csv
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value !== '');

When(
  '{actor} داشبورد آنالیز های روزانه را بدون فیلتر مشاهده می کند',
  (actor: Actor) => actor.attemptsTo(ViewBomDashboard.unfiltered()),
);

When(
  '{actor} داشبورد آنالیز های روزانه را با تاریخ و زمان ثبت بین {string} و {string} مشاهده می کند',
  (actor: Actor, from: string, to: string) =>
    actor.attemptsTo(ViewBomDashboard.filteredByDateRangeBetween(from, to)),
);

// The approval-filter rule: «وضعیت تایید» / «تایید/رد کننده» sit beside the date range and filter the
// whole dashboard — the product list and a selected product's panel alone. A comma-separated cell
// is a list of values, any of which matches (`ApprovalFilter.of`).
When(
  '{actor} داشبورد آنالیز های روزانه را با تاریخ و زمان ثبت بین {string} و {string} و انتخاب مقادیر {string} برای فیلتر {string} مشاهده می کند',
  (actor: Actor, from: string, to: string, valuesCsv: string, field: string) =>
    actor.attemptsTo(
      ViewBomDashboard.filteredByDateRangeAndApprovalBetween(from, to, [
        ApprovalFilter.of(field, splitValues(valuesCsv)),
      ]),
    ),
);

When(
  '{actor} داشبورد آنالیز های روزانه را با تاریخ و زمان ثبت بین {string} و {string} و وضعیت تایید {string} و تایید\\/رد کننده {string} مشاهده می کند',
  (
    actor: Actor,
    from: string,
    to: string,
    statuses: string,
    reviewers: string,
  ) =>
    actor.attemptsTo(
      ViewBomDashboard.filteredByDateRangeAndApprovalBetween(from, to, [
        ApprovalFilter.of('وضعیت تایید', splitValues(statuses)),
        ApprovalFilter.of('تایید/رد کننده', splitValues(reviewers)),
      ]),
    ),
);

When(
  '{actor} محصول {string} را از داشبورد با تاریخ و زمان ثبت بین {string} و {string} و انتخاب مقادیر {string} برای فیلتر {string} انتخاب می کند',
  (
    actor: Actor,
    productName: string,
    from: string,
    to: string,
    valuesCsv: string,
    field: string,
  ) =>
    actor.attemptsTo(
      OpenProductDailyBomList(productName, {
        range: { from, to },
        approvalFilters: [ApprovalFilter.of(field, splitValues(valuesCsv))],
      }),
    ),
);

When(
  '{actor} محصول {string} را از داشبورد با تاریخ و زمان ثبت بین {string} و {string} و وضعیت تایید {string} و تایید\\/رد کننده {string} انتخاب می کند',
  (
    actor: Actor,
    productName: string,
    from: string,
    to: string,
    statuses: string,
    reviewers: string,
  ) =>
    actor.attemptsTo(
      OpenProductDailyBomList(productName, {
        range: { from, to },
        approvalFilters: [
          ApprovalFilter.of('وضعیت تایید', splitValues(statuses)),
          ApprovalFilter.of('تایید/رد کننده', splitValues(reviewers)),
        ],
      }),
    ),
);

When(
  '{actor} محصول {string} را از داشبورد با بازه زمانی امروز انتخاب می کند',
  (actor: Actor, productName: string) =>
    actor.attemptsTo(OpenProductDailyBomList(productName)),
);

// The default-filter rule. The `Given` is passive, but what the filter shows is page state with no
// API behind it, so it drives the browser: open the dashboard, set the filter, leave the page.
Given(
  '{actor} پیش تر داشبورد آنالیز های روزانه را با انتخاب مقادیر {string} برای فیلتر {string} مشاهده کرده باشد',
  (actor: Actor, valuesCsv: string, field: string) =>
    actor.attemptsTo(
      HaveViewedBomDashboardEarlier.filteredBy([
        ApprovalFilter.of(field, splitValues(valuesCsv)),
      ]),
    ),
);

// «دوباره» — entering the dashboard anew, which `OpenProductDailyBomList` always does (it navigates
// to the page and opens the panel from scratch), so nothing of the earlier visit's page is reused.
When(
  '{actor} دوباره محصول {string} را از داشبورد با بازه زمانی امروز انتخاب می کند',
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

// The exact set of product rows shown, order aside — a product with no matching daily BOM in the
// range must be absent, not merely sorted last.
Then('فقط محصولات {string} نمایش داده شود', (productNamesCsv: string) =>
  actorInTheSpotlight().attemptsTo(
    EnsureProductListIsExactly(splitValues(productNamesCsv)),
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
        theProductInFocusOnTheDashboard(),
        splitValues(orderNumbersCsv),
      ),
    ),
);

// The weights and the difference are compared as the Gherkin writes them ("2"): the question brings
// each rendered Persian number back to that notation
// (`screenplay/common/persian-digits.ts#fromRenderedNumber`), and a blank difference cell back to
// "0" (`bom-dashboard-product-details.ts#differenceShownIn`). The
// description is free text, "-" standing for the em dash the page shows for an empty one. Free text
// is stored and shown with Latin digits (issue #62), so the background's «نوسان دستگاه شماره ۲» is
// expected back as «… 2» (`withLatinDigits`). The page shows it once per daily BOM, not per line,
// so each line is credited with its own card's description.
Then('لیست شامل موارد زیر باشد', (table: DataTable) => {
  const lines: DailyBomLine[] = table.hashes().map((row) => ({
    orderNumber: row['شماره سفارش'],
    componentName: row['نام جز'],
    materialName: row['نام مواد اولیه'],
    standardWeight: row['وزن استاندارد مواد اولیه'],
    actualWeight: row['وزن مواد اولیه'],
    difference: row['اختلاف وزن'],
    description: row['توضیحات'] === '-' ? '—' : withLatinDigits(row['توضیحات']),
  }));
  return actorInTheSpotlight().attemptsTo(
    EnsureDailyBomLinesAreExactly('کابل شبکه U/UTP 0.42 LEGRAND', lines),
  );
});

// The single-analysis `Given` registered a fresh product, and "that daily BOM" is its only one —
// the same reading as the `When` above.
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

// "فقط آنالیز های روزانه با شماره سفارش ... نمایش داده شود" and "وضعیت تایید آنالیز های روزانه به
// صورت زیر نمایش داده شود" are shared, byte for byte, with reporting-bom.feature — defined in
// step-definitions/common.steps.ts, dispatching to this page through `daily-bom-list-context.ts`
// (set by this feature's daily-BOM background). So is the "... توسط مصطفی تایید شده باشد"
// precondition.

When(
  '{actor} وزن مواد اولیه {string} جز {string} در آنالیز روزانه با شماره سفارش {string} را از داشبورد به {string} تغییر می دهد',
  (
    actor: Actor,
    materialName: string,
    componentName: string,
    orderNumber: string,
    weight: string,
  ) =>
    actor.attemptsTo(
      ChangeMaterialWeight.fromTheDashboard(
        orderNumber,
        componentName,
        materialName,
        weight,
      ),
    ),
);

When(
  '{actor} توضیحات آنالیز روزانه با شماره سفارش {string} را از داشبورد به {string} تغییر می دهد',
  (actor: Actor, orderNumber: string, description: string) =>
    actor.attemptsTo(
      ChangeDailyBomDescription.fromTheDashboard(orderNumber, description),
    ),
);

// Typed as the Gherkin gives it («… شماره ۲»), but free text is stored and shown with Latin digits
// (issue #62), so the card is expected to read «… شماره 2».
Then(
  'توضیحات آن آنالیز روزانه در داشبورد {string} نمایش داده شود',
  (description: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureTheDashboardShowsDescription(withLatinDigits(description)),
    ),
);

Then(
  'امتیاز آن آنالیز روزانه در داشبورد برابر {string} نمایش داده شود',
  (score: string) =>
    actorInTheSpotlight().attemptsTo(EnsureTheDashboardScoreIs(Number(score))),
);

When(
  '{actor} آنالیز روزانه با شماره سفارش {string} را از داشبورد تایید می کند',
  (actor: Actor, orderNumber: string) =>
    actor.attemptsTo(ApproveDailyBom.fromTheDashboard(orderNumber)),
);

When(
  '{actor} آنالیز روزانه با شماره سفارش {string} را از داشبورد با دلیل {string} عدم تایید می کند',
  (actor: Actor, orderNumber: string, reason: string) =>
    actor.attemptsTo(RejectDailyBom.fromTheDashboard(orderNumber, reason)),
);

// The «از داشبورد» approve outline's `Then`s — «وضعیت آن آنالیز روزانه "…" باشد», «تایید/رد کننده آن
// "…" باشد» — are approving-bom.feature's, defined in approving-bom.steps.ts and read through the
// API; the approve task above brings the daily BOM into focus for them. The reject outline's `Then`
// below reads the card instead: it says «در داشبورد».

Then(
  'وضعیت آن آنالیز روزانه در داشبورد {string} و تایید\\/رد کننده آن {string} نمایش داده شود',
  (approvalStatus: string, reviewerName: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureTheDashboardShowsTheReview(
        approvalStatus,
        realNameFor(reviewerName),
      ),
    ),
);

Then('آن آنالیز روزانه دیگر در داشبورد نمایش داده نشود', () =>
  actorInTheSpotlight().attemptsTo(
    EnsureTheDashboardNoLongerShowsThatDailyBom(),
  ),
);

// The two score steps say "نمایش داده شود", but the dashboard no longer shows a score: both are
// answered through the API (see `bom-dashboard-product-details.ts`'s module comment). The ordering
// step still checks the panels' on-screen order as well.
Then('امتیاز آن آنالیز روزانه برابر {string} نمایش داده شود', (score: string) =>
  actorInTheSpotlight().attemptsTo(
    EnsureDailyBomScoreIs(theLastRegisteredProduct(), Number(score)),
  ),
);

Then(
  'آنالیز های روزانه به ترتیب زیر بر اساس امتیاز نمایش داده شود',
  (table: DataTable) =>
    actorInTheSpotlight().attemptsTo(
      EnsureDailyBomsRankedByScore(
        theProductRegisteredWithName('کابل شبکه U/UTP 0.42 LEGRAND'),
        table.hashes().map((row) => ({
          orderNumber: row['شماره سفارش'],
          score: Number(row['امتیاز']),
        })),
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
