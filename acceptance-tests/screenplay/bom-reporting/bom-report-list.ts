import {
  d,
  Interaction,
  notes,
  Question,
  QuestionAdapter,
  Task,
  Wait,
} from '@serenity-js/core';
import { equals, Ensure, isPresent, not } from '@serenity-js/assertions';
import { Click, Enter, isVisible, Navigate, Text } from '@serenity-js/web';
import { BomReportsPage } from '../ui/bom-reports-page';
import { AuthNotes, LogIn } from '../common/login';
import { PersonaCredentialsNotes } from '../common/personas';
import { splitJalaliDateTimeText } from '../common/jalali-datetime';

/**
 * Domain layer for "مشاهده آنالیز روزانه" (`reporting-bom.feature`) — every scenario is UI-voiced
 * (an active "سینا ... مشاهده می کند"/"فیلتر می کند"), so every task here drives the real report
 * page, never the API (`screenplay/bom-registration/view-bom-list.ts`'s own `ViewBomList` already
 * covers the API door for the unrelated bom-registration feature and isn't reused here on purpose:
 * that task hits `GET /boms`, a different endpoint from this feature's own `POST /boms/report`).
 *
 * The Persian field names below are exactly the ones the feature itself uses — both in the report
 * list's own column headers and in the Scenario Outline's "فیلد" column — so no separate mapping
 * table is needed to talk about them; the API's own filter keys (`brands`, `componentNames`, …) are
 * an implementation detail the frontend is assumed to own, never surfaced here.
 */

/** Establishes a real browser session before the report page is ever navigated to — mirrors
 * `screenplay/bom-registration/bom-form.ts#EstablishBrowserSession`; see that module's comment for
 * the full reasoning (this feature's own background only authenticates `CallAnApi`, not the
 * browser). */
const EstablishBrowserSession = (): Task =>
  Task.where(
    '#actor establishes a browser session for the daily BOM report UI',
    LogIn.using(
      notes<AuthNotes>().get('username'),
      notes<PersonaCredentialsNotes>().get('password'),
    ),
  );

/** The "locate task" every UI-driving task below starts from. Route "/boms" — the one daily-BOM
 * page, where browsing/filtering/exporting and registering/editing/deleting share a list. There is
 * no separate report route; `screenplay/bom-registration/bom-form.ts` locates the same page. */
const LocateBomReportsPage = (): Task =>
  Task.where(
    '#actor locates the daily BOM report page',
    EstablishBrowserSession(),
    Navigate.to('/boms'),
    Wait.until(BomReportsPage.heading(), isVisible()),
  );

/**
 * Polls until the filter dialog this feature's checkbox-filtering tasks open has closed again — the
 * signal that the report has re-fetched and re-rendered against the newly applied filter. Mirrors
 * this suite's "submitting means clicking *and* waiting for the answer" convention
 * (`acceptance-tests/CLAUDE.md`), applied to a `MatDialog` rather than a form. Only ever used for the
 * five checkbox-filterable fields — "تاریخ و زمان ثبت" has no such dialog to close
 * (`ui/bom-reports-page.ts`'s own class-level comment), so its own apply button gets
 * `WaitForTheReportToSettle` below instead.
 */
const WaitForTheFilterPanelToClose = () =>
  Wait.until(BomReportsPage.applyFilterButton(), not(isVisible()));

/**
 * Polls until the report's own loading indicator has cleared — the signal a page change, a
 * checkbox-filter dialog's apply, or the date-range's own apply button (which, unlike the filter
 * dialog, never disappears on its own — `ui/bom-reports-page.ts`'s own class-level comment) has been
 * answered. A brief settle delay precedes the poll: `reportResource`'s loading state flips
 * reactively but not necessarily perfectly synchronously with the click that triggered it, and
 * polling from the very first tick risks reading "not loading" from BEFORE the request even started
 * rather than after it finished.
 */
const WaitForTheReportToSettle = (): Interaction =>
  Interaction.where(
    '#actor waits for the daily BOM report to finish loading',
    async (actor) => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const deadline = Date.now() + 5_000;
      do {
        const indicator = await actor.answer(BomReportsPage.loadingIndicator());
        if (!(await indicator.isPresent())) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      } while (Date.now() < deadline);
    },
  );

/** The one field with no checkbox filter dialog at all — see `ui/bom-reports-page.ts`'s own
 * class-level comment. */
const REGISTERED_AT_FIELD = 'تاریخ و زمان ثبت';

/** "تاریخ و زمان ثبت"'s own "با انتخاب مقادیر ... برای فیلتر ..." step: the field carries no
 * checkbox panel to select values from, only the persistent range control — so a single exact value
 * is expressed as a from/to range of that one instant (the backend's own `registeredAtFrom`/
 * `registeredAtTo` are both inclusive, confirmed against `bom-report.repository.ts`), matching only
 * that instant. Every value the scenario outline exercises for this field is a single one; sorting
 * before taking the first/last keeps this correct if that ever changes. */
const SelectRegisteredAtExactly = (values: string[]): Task => {
  const sorted = [...values].sort();
  const from = splitJalaliDateTimeText(sorted[0]);
  const to = splitJalaliDateTimeText(sorted[sorted.length - 1]);
  return Task.where(
    d`#actor filters "${REGISTERED_AT_FIELD}" to exactly ${values.join('، ')}`,
    Enter.theValue(from.date).into(BomReportsPage.dateRangeFromField()),
    Enter.theValue(from.time).into(BomReportsPage.dateRangeFromTimeField()),
    Enter.theValue(to.date).into(BomReportsPage.dateRangeToField()),
    Enter.theValue(to.time).into(BomReportsPage.dateRangeToTimeField()),
    Click.on(BomReportsPage.applyDateRangeButton()),
    WaitForTheReportToSettle(),
  );
};

/** Opens `field`'s Excel-style filter dialog, unchecks its "select all" (clearing every value), and
 * checks exactly `values` before applying — "با انتخاب مقادیر ... برای فیلتر ..." for every
 * checkbox-filterable field. "تاریخ و زمان ثبت" is routed to `SelectRegisteredAtExactly` instead,
 * since it has no such dialog. */
const SelectOnlyTheseValuesFor = (field: string, values: string[]): Task =>
  field === REGISTERED_AT_FIELD
    ? SelectRegisteredAtExactly(values)
    : Task.where(
        d`#actor filters "${field}" to just ${values.join('، ')}`,
        Click.on(BomReportsPage.columnFilterButton(field)),
        Click.on(BomReportsPage.filterSelectAllCheckbox()),
        ...values.map((value) =>
          Click.on(BomReportsPage.filterValueCheckbox(value)),
        ),
        Click.on(BomReportsPage.applyFilterButton()),
        WaitForTheFilterPanelToClose(),
      );

export const ViewBomReportList = {
  /** "سینا لیست آنالیز های روزانه را بدون فیلتر مشاهده می کند" / "... را مشاهده می کند" (the
   * "وزن مواد اولیه" rule's own, filter-agnostic phrasing) — both just need the unfiltered list. */
  unfiltered: (): Task =>
    Task.where(
      '#actor views the daily BOM report list, without any filter',
      LocateBomReportsPage(),
    ),

  /** The Scenario Outline's "با انتخاب مقادیر ... برای فیلتر ..." step. */
  filteredBySelectingValuesFor: (field: string, values: string[]): Task =>
    Task.where(
      d`#actor views the daily BOM report list, filtering "${field}"`,
      LocateBomReportsPage(),
      SelectOnlyTheseValuesFor(field, values),
    ),

  /** "با انتخاب مقادیر زیر" — the combination-of-fields example. */
  filteredByCombination: (
    filters: Array<{ field: string; values: string[] }>,
  ): Task =>
    Task.where(
      '#actor views the daily BOM report list, filtering by a combination of fields',
      LocateBomReportsPage(),
      ...filters.map(({ field, values }) =>
        SelectOnlyTheseValuesFor(field, values),
      ),
    ),

  /** "با عدم انتخاب مقدار ... برای فیلتر ..." */
  withValueDeselectedFor: (field: string, value: string): Task =>
    Task.where(
      d`#actor views the daily BOM report list, deselecting "${value}" from "${field}"`,
      LocateBomReportsPage(),
      Click.on(BomReportsPage.columnFilterButton(field)),
      Click.on(BomReportsPage.filterValueCheckbox(value)),
      Click.on(BomReportsPage.applyFilterButton()),
      WaitForTheFilterPanelToClose(),
    ),

  /** "با عدم انتخاب همه مقادیر فیلتر ..." — unchecking the master checkbox clears every value at
   * once, per the feature's own "فیلتر بدون هیچ مقدار انتخاب شده" rule. */
  withAllValuesDeselectedFor: (field: string): Task =>
    Task.where(
      d`#actor views the daily BOM report list, deselecting every value of "${field}"`,
      LocateBomReportsPage(),
      Click.on(BomReportsPage.columnFilterButton(field)),
      Click.on(BomReportsPage.filterSelectAllCheckbox()),
      Click.on(BomReportsPage.applyFilterButton()),
      WaitForTheFilterPanelToClose(),
    ),

  /** "بین دو تاریخ و زمان" — `app-jalali-datetime-field` renders the date and time of day as two
   * separate textboxes bound to one value, so each Gherkin string is split with
   * `splitJalaliDateTimeText` and entered into its own field; typing the whole string into the
   * date-only field fails to parse and silently leaves the range unapplied (see that function's
   * own comment). */
  filteredByDateRangeBetween: (from: string, to: string): Task => {
    const fromParts = splitJalaliDateTimeText(from);
    const toParts = splitJalaliDateTimeText(to);
    return Task.where(
      d`#actor views the daily BOM report list, filtering "تاریخ و زمان ثبت" between "${from}" and "${to}"`,
      LocateBomReportsPage(),
      Enter.theValue(fromParts.date).into(BomReportsPage.dateRangeFromField()),
      Enter.theValue(fromParts.time).into(
        BomReportsPage.dateRangeFromTimeField(),
      ),
      Enter.theValue(toParts.date).into(BomReportsPage.dateRangeToField()),
      Enter.theValue(toParts.time).into(BomReportsPage.dateRangeToTimeField()),
      Click.on(BomReportsPage.applyDateRangeButton()),
      WaitForTheReportToSettle(),
    );
  },

  /** "از یک تاریخ و زمان تا اکنون" — the "to" field is left untouched, matching the API contract's
   * own "absent means unfiltered" rule for `registeredAtTo` (see the dispatch this automation was
   * written against). Same date/time split as `filteredByDateRangeBetween`. */
  filteredByDateRangeFrom: (from: string): Task => {
    const fromParts = splitJalaliDateTimeText(from);
    return Task.where(
      d`#actor views the daily BOM report list, filtering "تاریخ و زمان ثبت" from "${from}" to now`,
      LocateBomReportsPage(),
      Enter.theValue(fromParts.date).into(BomReportsPage.dateRangeFromField()),
      Enter.theValue(fromParts.time).into(
        BomReportsPage.dateRangeFromTimeField(),
      ),
      Click.on(BomReportsPage.applyDateRangeButton()),
      WaitForTheReportToSettle(),
    );
  },
};

/** "همه مقادیر فیلتر ... را دوباره انتخاب می کند" — re-checking "select all" on an already-open
 * scenario's filtered field clears that field's filter entirely, per the "انتخاب دوباره همه مقادیر
 * یک فیلد" rule. Assumes the report page (and that field's filter panel) is already open from a
 * preceding "فیلتر ... اعمال کرده باشد" step. */
export const ReselectAllValuesFor = (field: string): Task =>
  Task.where(
    d`#actor reselects every value of "${field}"`,
    Click.on(BomReportsPage.columnFilterButton(field)),
    Click.on(BomReportsPage.filterSelectAllCheckbox()),
    Click.on(BomReportsPage.applyFilterButton()),
    WaitForTheFilterPanelToClose(),
  );

const parseOrderNumberList = (csv: string): string[] =>
  csv.split(',').map((value) => value.trim());

const SortedOrderNumberCells = (): QuestionAdapter<string[]> =>
  Question.about('the report list order numbers, sorted', async (actor) => {
    const values = await actor.answer(
      Text.ofAll(BomReportsPage.orderNumberCells()),
    );
    return [...values].sort();
  });

/** "انتظار می رود تمام آنالیز های روزانه ثبت شده نمایش داده شود" — order-independent: this step is
 * reused after both the plain unfiltered view and the "انتخاب دوباره همه مقادیر" rule, neither of
 * which makes any claim about rendered order (the dedicated sort rule, `EnsureDailyBomsShownInOrder`
 * below, is what actually tests that). */
export const EnsureAllRegisteredDailyBomsAreShown = (
  registeredOrderNumbers: string[],
): Task =>
  Task.where(
    '#actor ensures every registered daily BOM is shown',
    Ensure.that(
      SortedOrderNumberCells(),
      equals([...registeredOrderNumbers].sort()),
    ),
  );

/** "انتظار می رود فقط آنالیز های روزانه با شماره سفارش «...» نمایش داده شود" — a CSV list, order-
 * independent (unlike `EnsureDailyBomsShownInOrder`, which the dedicated ordering scenario needs). */
export const EnsureOnlyDailyBomsWithOrderNumbersShown = (csv: string): Task =>
  Task.where(
    d`#actor ensures only the daily BOMs "${csv}" are shown`,
    Ensure.that(
      SortedOrderNumberCells(),
      equals([...parseOrderNumberList(csv)].sort()),
    ),
  );

/** "انتظار می رود آنالیز های روزانه به ترتیب زیر نمایش داده شود" */
export const EnsureDailyBomsShownInOrder = (orderNumbers: string[]): Task =>
  Task.where(
    '#actor ensures the daily BOMs are shown in the expected order',
    Ensure.that(
      Text.ofAll(BomReportsPage.orderNumberCells()),
      equals(orderNumbers),
    ),
  );

/** "انتظار می رود لیست فقط شامل ستون های زیر باشد" */
export const EnsureReportColumnsAreExactly = (columns: string[]): Task =>
  Task.where(
    '#actor ensures the report list shows exactly the expected columns',
    Ensure.that(Text.ofAll(BomReportsPage.columnHeaders()), equals(columns)),
  );

/** "انتظار می رود وزن مواد اولیه در فیلدهای قابل فیلتر نمایش داده نشود" */
export const EnsureMaterialWeightIsNotAFilterableField = (): Task =>
  Task.where(
    '#actor ensures material weight is not a filterable field',
    Ensure.that(
      BomReportsPage.columnFilterButton('وزن مواد اولیه'),
      not(isPresent()),
    ),
  );

/**
 * The identity "کاربری که وارد سیستم نشده" (an anonymous, never-logged-in visitor) hangs off —
 * mirrors `screenplay/authentication/logging-in.ts#loginAttemptActorName`; this feature area gets
 * its own rather than importing that one, the same way `screenplay/bom-registration/bom-form.ts`'s
 * own comment explains why each feature area owns its small helpers independently.
 */
export const anonymousVisitorActorName = 'کاربر مهمان';

/** "کاربری که وارد سیستم نشده تلاش می کند لیست آنالیز های روزانه را مشاهده کند" — navigates
 * straight to the report page with no prior login at all, exercising the frontend's own route
 * guard (the same `authGuard` UX behaviour `LocateBomReportsPage`'s login normally pre-empts). */
export const AttemptToViewBomReportListWithoutLoggingIn = (): Task =>
  Task.where(
    '#actor attempts to view the daily BOM report list without logging in',
    Navigate.to('/boms'),
  );
