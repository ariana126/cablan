import {
  d,
  Interaction,
  notes,
  Question,
  QuestionAdapter,
  Task,
  Wait,
} from '@serenity-js/core';
import { Ensure, equals, not } from '@serenity-js/assertions';
import { Click, isVisible, Navigate, Text } from '@serenity-js/web';
import { BomDashboardPage } from '../ui/bom-dashboard-page';
import { AuthNotes, LogIn } from '../common/login';
import { PersonaCredentialsNotes, realNameFor } from '../common/personas';
import { PickJalaliDateTime } from '../common/pick-jalali-date-time';

/**
 * Domain layer for "داشبورد بررسی روزانه آنالیز ها" (`bom-dashboard.feature`) — every scenario's
 * `When` is UI-voiced (an active "نیکروش ... مشاهده می کند"/"انتخاب می کند"), so every task here
 * drives the real dashboard page, never the API. (The two score `Then`s are the exception, read
 * through the API because the page no longer shows a score — see
 * `bom-dashboard-product-details.ts`.)
 *
 * Mirrors `screenplay/bom-reporting/bom-report-list.ts` exactly: same `EstablishBrowserSession` →
 * `Locate…Page` chain, same `WaitForTheReportToSettle` for the date-range control, same
 * `anonymousVisitorActorName` for the unauthenticated rule. The dashboard's per-product
 * selection is implemented on the dispatch's "fetch each product's boms with their details when
 * the user selects that product" — the product list itself comes back with only id/name/count
 * (no daily-BOM rows), and a per-product panel is fetched and rendered on click.
 */

/** Establishes a real browser session before the dashboard page is ever navigated to — mirrors
 * `screenplay/bom-reporting/bom-report-list.ts#EstablishBrowserSession`; see that module's
 * comment for the full reasoning (this feature's own background only authenticates `CallAnApi`,
 * not the browser). */
const EstablishBrowserSession = (): Task =>
  Task.where(
    '#actor establishes a browser session for the daily BOM dashboard UI',
    LogIn.using(
      notes<AuthNotes>().get('username'),
      notes<PersonaCredentialsNotes>().get('password'),
    ),
  );

/** The "locate task" every UI-driving task below starts from. ASSUMPTION: route "/boms/dashboard". */
const LocateBomDashboardPage = (): Task =>
  Task.where(
    '#actor locates the daily BOM dashboard page',
    EstablishBrowserSession(),
    Navigate.to('/boms/dashboard'),
    Wait.until(BomDashboardPage.heading(), isVisible()),
  );

/**
 * Polls until the dashboard's own loading indicator has cleared — the signal a date-range apply
 * has been answered. Mirrors `bom-report-list.ts#WaitForTheReportToSettle` (same dashboard-side
 * pattern, same `loadingIndicator` semantics). A brief settle delay precedes the poll: the
 * loading state flips reactively but not necessarily perfectly synchronously with the click that
 * triggered it, and polling from the very first tick risks reading "not loading" from BEFORE the
 * request even started rather than after it finished.
 */
const WaitForTheDashboardToSettle = (): Interaction =>
  Interaction.where(
    '#actor waits for the daily BOM dashboard to finish loading',
    async (actor) => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const deadline = Date.now() + 5_000;
      do {
        const indicator = await actor.answer(
          BomDashboardPage.loadingIndicator(),
        );
        if (!(await indicator.isPresent())) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      } while (Date.now() < deadline);
    },
  );

/** Product-name cells from the dashboard's product list, in rendered (top-to-bottom) order. */
const ProductNameCells = (): QuestionAdapter<string[]> =>
  Question.about(
    'the dashboard product list product names, in rendered order',
    async (actor) => {
      // The dashboard's product list is itself a `mat-table`, so the same `.mat-mdc-row
      // td:first-child` anchor `BomReportsPage.orderNumberCells` already relies on is the
      // simplest path to "products in rendered order" — the product name is the only thing the
      // dashboard returns in that column per the dispatch's API surface (`{ productId,
      // productName, dailyBomCount }`).
      return actor.answer(Text.ofAll(BomDashboardPage.productNameCells()));
    },
  );

/** Sorted product-name cells, for order-independent assertions — mirrors
 * `bom-report-list.ts#SortedOrderNumberCells`. */
const SortedProductNameCells = (): QuestionAdapter<string[]> =>
  Question.about(
    'the dashboard product list product names, sorted',
    async (actor) => {
      const values = await actor.answer(ProductNameCells());
      return [...values].sort();
    },
  );

/** The two Excel-style filters beside the dashboard's date range, by the name the page gives them. */
export type ApprovalFilterField = 'وضعیت تایید' | 'تایید کننده';

/** One approval filter as the visitor sets it: the field, and the values ticked in its dialog —
 * any of which matches. */
export interface ApprovalFilter {
  field: ApprovalFilterField;
  values: string[];
}

/** The value the «تایید کننده» filter lists for daily BOMs nobody has approved. */
const NO_APPROVER = 'بدون تایید کننده';

const APPROVAL_FILTER_FIELDS: readonly ApprovalFilterField[] = [
  'وضعیت تایید',
  'تایید کننده',
];

export const ApprovalFilter = {
  /** Reads a filter the way the Gherkin states it. An approver is named as the business names the
   * persona; the dialog lists the name the backend stores (`personas.ts#realNameFor`), which
   * differs only for یاشار. */
  of: (field: string, values: string[]): ApprovalFilter => {
    const known = APPROVAL_FILTER_FIELDS.find((each) => each === field);
    if (!known) {
      throw new Error(
        `"${field}" is not one of the dashboard's approval filters (${APPROVAL_FILTER_FIELDS.join('، ')}).`,
      );
    }
    return {
      field: known,
      values:
        known === 'تایید کننده'
          ? values.map((value) =>
              value === NO_APPROVER ? value : realNameFor(value),
            )
          : values,
    };
  },
};

/** Sets the dashboard's date range from each bound's calendar and clock, applies it, and waits for
 * the product list to be re-fetched. */
const ApplyTheDateRange = (from: string, to: string): Task =>
  Task.where(
    d`#actor applies the dashboard date range "${from}" to "${to}"`,
    PickJalaliDateTime.of(from).in(BomDashboardPage.registeredAtFrom()),
    PickJalaliDateTime.of(to).in(BomDashboardPage.registeredAtTo()),
    Click.on(BomDashboardPage.applyDateRangeButton()),
    WaitForTheDashboardToSettle(),
  );

/** Opens one approval filter's dialog, clears every value through «انتخاب همه», ticks exactly
 * `values` and applies. The filter is applied server-side the moment the dialog applies — no
 * «اعمال بازه» click — so the task waits for the dialog to close and then for the product list to
 * settle. */
const ApplyTheApprovalFilter = ({ field, values }: ApprovalFilter): Task =>
  Task.where(
    d`#actor filters the dashboard by "${field}" to just ${values.join('، ')}`,
    Click.on(BomDashboardPage.approvalFilterButton(field)),
    Click.on(BomDashboardPage.filterSelectAllCheckbox()),
    ...values.map((value) =>
      Click.on(BomDashboardPage.filterValueCheckbox(value)),
    ),
    Click.on(BomDashboardPage.applyFilterButton()),
    Wait.until(BomDashboardPage.applyFilterButton(), not(isVisible())),
    WaitForTheDashboardToSettle(),
  );

export const ViewBomDashboard = {
  /** "نیکروش داشبورد آنالیز های روزانه را بدون فیلتر مشاهده می کند" — the plain unfiltered view.
   * No `from`/`to` are sent, so the backend answers with every product that has at least one
   * daily BOM. */
  unfiltered: (): Task =>
    Task.where(
      '#actor views the daily BOM dashboard, without any filter',
      LocateBomDashboardPage(),
    ),

  /** "نیکروش داشبورد ... را با تاریخ و زمان ثبت بین ... و ... مشاهده می کند" — the date-range
   * filter step from the feature's "فیلتر بر اساس بازه زمانی" rule. Strings are the literal
   * Jalali "YYYY/MM/DD HH:mm" text from the Gherkin — user-facing field values, not
   * backend-clock inputs, so no `parseJalaliDateTime` here. Each bound is picked from its
   * calendar and clock (`screenplay/common/pick-jalali-date-time.ts`), since the inputs are
   * read-only. Mirrors `bom-report-list.ts#ViewBomReportList.filteredByDateRangeBetween`. */
  filteredByDateRangeBetween: (from: string, to: string): Task =>
    Task.where(
      d`#actor views the daily BOM dashboard, filtering "تاریخ و زمان ثبت" between "${from}" and "${to}"`,
      LocateBomDashboardPage(),
      ApplyTheDateRange(from, to),
    ),

  /** "... بین ... و ... و انتخاب مقادیر ... برای فیلتر ... مشاهده می کند" and the two-filter
   * "... و وضعیت تایید ... و تایید کننده ... مشاهده می کند" — the date range first, through its own
   * apply, then each approval filter beside it, in turn. */
  filteredByDateRangeAndApprovalBetween: (
    from: string,
    to: string,
    filters: ApprovalFilter[],
  ): Task =>
    Task.where(
      d`#actor views the daily BOM dashboard between "${from}" and "${to}", filtered by ${filters.map(({ field }) => field).join(' و ')}`,
      LocateBomDashboardPage(),
      ApplyTheDateRange(from, to),
      ...filters.map(ApplyTheApprovalFilter),
    ),
};

/** "انتظار می رود تمام محصولات دارای آنالیز روزانه نمایش داده شود" — order-independent, mirroring
 * `bom-report-list.ts#EnsureAllRegisteredDailyBomsAreShown`. */
export const EnsureProductListIsExactly = (productNames: string[]): Task =>
  Task.where(
    '#actor ensures the dashboard product list is exactly the expected set',
    Ensure.that(SortedProductNameCells(), equals([...productNames].sort())),
  );

/** "انتظار می رود فهرست خالی نمایش داده شود" — the page-agnostic shared step
 * (`step-definitions/common.steps.ts#فهرست خالی نمایش داده شود`) already covers this case, but
 * exported here for any direct call site that wants to be explicit (none today; kept for
 * symmetry with `bom-report-list.ts`'s shape). */
export const EnsureProductListIsEmpty = (): Task =>
  Task.where(
    '#actor ensures the dashboard product list is empty',
    Ensure.that(BomDashboardPage.productNameCells().count(), equals(0)),
  );

/**
 * The identity "کاربری که وارد سیستم نشده" (an anonymous, never-logged-in visitor) hangs off —
 * mirrors `screenplay/bom-reporting/bom-report-list.ts#anonymousVisitorActorName`; this feature
 * area gets its own rather than importing that one, the same way `bom-report-list.ts`'s own
 * comment explains why each feature area owns its small helpers independently.
 */
export const anonymousVisitorActorName = 'کاربر مهمان';

/** "کاربری که وارد سیستم نشده تلاش می کند داشبورد آنالیز های روزانه را مشاهده کند" — navigates
 * straight to the dashboard page with no prior login at all, exercising the frontend's own route
 * guard (the same `authGuard` UX behaviour `LocateBomDashboardPage`'s login normally pre-empts). */
export const AttemptToViewBomDashboardWithoutLoggingIn = (): Task =>
  Task.where(
    '#actor attempts to view the daily BOM dashboard without logging in',
    Navigate.to('/boms/dashboard'),
  );
