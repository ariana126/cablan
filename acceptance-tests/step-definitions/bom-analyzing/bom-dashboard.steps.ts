import { Given, When, Then, DataTable } from '@cucumber/cucumber';
import { Actor, actorCalled, actorInTheSpotlight } from '@serenity-js/core';
import {
  AttemptToViewBomDashboardWithoutLoggingIn,
  EnsureProductListIsExactly,
  ViewBomDashboard,
  anonymousVisitorActorName,
} from '../../screenplay/bom-analyzing/bom-dashboard-list';
import {
  ChangeMaterialWeight,
  DailyBomLine,
  EnsureDailyBomLinesAreExactly,
  EnsureDailyBomScoreIs,
  EnsureDailyBomsRankedByScore,
  EnsureDailyBomsWithOrderNumbersShown,
  EnsureTheDashboardScoreIs,
  EnsureTheDashboardShowsApproval,
  FilterTheProductDailyBomList,
  OpenProductDailyBomList,
  OpenThatDailyBomListInTheDashboard,
  theProductInFocusOnTheDashboard,
} from '../../screenplay/bom-analyzing/bom-dashboard-product-details';
import {
  ApproveDailyBom,
  RevokeDailyBomApproval,
} from '../../screenplay/bom-analyzing/daily-bom-approval';
import { realNameFor } from '../../screenplay/common/personas';
import {
  theLastRegisteredProduct,
  theProductRegisteredWithName,
} from '../../screenplay/bom-registration/product-details';

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
  'آنالیز های روزانه با شماره سفارش {string} برای آن محصول نمایش داده شود',
  (orderNumbersCsv: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureDailyBomsWithOrderNumbersShown(
        theProductInFocusOnTheDashboard(),
        splitValues(orderNumbersCsv),
      ),
    ),
);

// The weight is compared as the Gherkin writes it ("2"): the question brings the rendered Persian
// number back to that notation (`screenplay/common/persian-digits.ts#fromRenderedNumber`). The
// description is free text and is compared verbatim, "-" standing for the em dash the page shows
// for an empty one. The page shows it once per daily BOM, not per line, so each line is credited
// with its own card's description.
Then('لیست شامل موارد زیر باشد', (table: DataTable) => {
  const lines: DailyBomLine[] = table.hashes().map((row) => ({
    orderNumber: row['شماره سفارش'],
    componentName: row['نام جز'],
    materialName: row['نام مواد اولیه'],
    actualWeight: row['وزن مواد اولیه'],
    description: row['توضیحات'] === '-' ? '—' : row['توضیحات'],
  }));
  return actorInTheSpotlight().attemptsTo(
    EnsureDailyBomLinesAreExactly('کابل شبکه U/UTP 0.42 LEGRAND', lines),
  );
});

// "فقط آنالیز های روزانه با شماره سفارش ... نمایش داده شود" and "وضعیت تایید آنالیز های روزانه به
// صورت زیر نمایش داده شود" are shared, byte for byte, with reporting-bom.feature — defined in
// step-definitions/common.steps.ts, dispatching to this page through `daily-bom-list-context.ts`
// (set by this feature's daily-BOM background). So is the "... توسط مصطفی تایید شده باشد"
// precondition.

// The column-filter rule's precondition is UI-voiced on purpose despite being a `Given`: the
// `When` after it filters the panel this opens, in the same browser.
Given(
  '{actor} محصول {string} را از داشبورد با بازه زمانی امروز انتخاب کرده باشد',
  (actor: Actor, productName: string) =>
    actor.attemptsTo(OpenProductDailyBomList(productName)),
);

When(
  '{actor} لیست آنالیز های روزانه آن محصول را با انتخاب مقادیر {string} برای فیلتر {string} مشاهده می کند',
  (actor: Actor, valuesCsv: string, field: string) =>
    actor.attemptsTo(
      FilterTheProductDailyBomList.bySelectingValuesFor(
        theProductInFocusOnTheDashboard(),
        field,
        splitValues(valuesCsv),
      ),
    ),
);

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
  '{actor} تایید آنالیز روزانه با شماره سفارش {string} را از داشبورد لغو می کند',
  (actor: Actor, orderNumber: string) =>
    actor.attemptsTo(RevokeDailyBomApproval.fromTheDashboard(orderNumber)),
);

// The card shows the approver's name as the backend stores it — for یاشار, the seeded account's
// own (`personas.ts#realNameFor`) — and «-» when there is none.
Then(
  'وضعیت آن آنالیز روزانه در داشبورد {string} و تایید کننده آن {string} نمایش داده شود',
  (status: string, approverName: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureTheDashboardShowsApproval(status, realNameFor(approverName)),
    ),
);

Then(
  'وضعیت آن آنالیز روزانه در داشبورد {string} و بدون تایید کننده نمایش داده شود',
  (status: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureTheDashboardShowsApproval(status, '-'),
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
