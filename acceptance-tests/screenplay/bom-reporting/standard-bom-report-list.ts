import {
  d,
  Interaction,
  notes,
  Question,
  QuestionAdapter,
  Task,
  Wait,
} from '@serenity-js/core';
import { Ensure, equals, isPresent, not } from '@serenity-js/assertions';
import { Click, isVisible, Navigate, Text } from '@serenity-js/web';
import { StandardBomReportsPage } from '../ui/standard-bom-reports-page';
import { AuthNotes, LogIn } from '../common/login';
import { PersonaCredentialsNotes } from '../common/personas';

/**
 * Domain layer for "مشاهده آنالیز استاندارد" (`reporting-standard-bom.feature`) —
 * every scenario is UI-voiced (an active "سینا ... مشاهده می کند"/"فیلتر می کند"),
 * so every task here drives the real report page, never the API.
 *
 * Mirrors `screenplay/bom-reporting/bom-report-list.ts` pattern.
 */

/** Establishes a real browser session before the report page is ever navigated to. */
const EstablishBrowserSession = (): Task =>
  Task.where(
    '#actor establishes a browser session for the standard BOM report UI',
    LogIn.using(
      notes<AuthNotes>().get('username'),
      notes<PersonaCredentialsNotes>().get('password'),
    ),
  );

/** The "locate task" every UI-driving task below starts from. ASSUMPTION: route "/standard-boms/report". */
const LocateStandardBomReportPage = (): Task =>
  Task.where(
    '#actor locates the standard BOM report page',
    EstablishBrowserSession(),
    Navigate.to('/standard-boms/report'),
    Wait.until(StandardBomReportsPage.heading(), isVisible()),
  );

/**
 * Polls until the filter dialog this feature's checkbox-filtering tasks open has closed again —
 * the signal that the report has re-fetched and re-rendered against the newly applied filter.
 * Mirrors `bom-report-list.ts`'s `WaitForTheFilterPanelToClose`.
 */
const WaitForTheFilterPanelToClose = () =>
  Wait.until(StandardBomReportsPage.applyFilterButton(), not(isVisible()));

/**
 * Polls until the report's own loading indicator has cleared — the signal a page change,
 * a checkbox-filter dialog's apply, or other action has been answered.
 */
const WaitForTheReportToSettle = (): Interaction =>
  Interaction.where(
    '#actor waits for the standard BOM report to finish loading',
    async (actor) => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const deadline = Date.now() + 5_000;
      do {
        const indicator = await actor.answer(
          StandardBomReportsPage.loadingIndicator(),
        );
        if (!(await indicator.isPresent())) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      } while (Date.now() < deadline);
    },
  );

/** Filterable fields for standard BOM report. */

/**
 * Opens `field`'s Excel-style filter dialog, unchecks its "select all" (clearing every value),
 * and checks exactly `values` before applying.
 */
const SelectOnlyTheseValuesFor = (field: string, values: string[]): Task =>
  Task.where(
    d`#actor filters "${field}" to just ${values.join('، ')}`,
    Click.on(StandardBomReportsPage.columnFilterButton(field)),
    Click.on(StandardBomReportsPage.filterSelectAllCheckbox()),
    ...values.map((value) =>
      Click.on(StandardBomReportsPage.filterValueCheckbox(value)),
    ),
    Click.on(StandardBomReportsPage.applyFilterButton()),
    WaitForTheFilterPanelToClose(),
  );

/**
 * Opens `field`'s filter dialog and unchecks exactly `value` (deselecting it).
 */
const DeselectValueFor = (field: string, value: string): Task =>
  Task.where(
    d`#actor deselects "${value}" from "${field}"`,
    Click.on(StandardBomReportsPage.columnFilterButton(field)),
    Click.on(StandardBomReportsPage.filterValueCheckbox(value)),
    Click.on(StandardBomReportsPage.applyFilterButton()),
    WaitForTheFilterPanelToClose(),
  );

/** Sorts by product name column. The page starts at ascending, so one click on the header
 *  goes to descending. For ascending, the page is already at that state. */
const SortByProductName = (direction: 'asc' | 'desc'): Task =>
  Task.where(
    d`#actor sorts by product name ${direction}`,
    ...(direction === 'desc'
      ? [Click.on(StandardBomReportsPage.productNameHeader())]
      : []),
    WaitForTheReportToSettle(),
  );

/**
 * Parses a comma-separated list of MI codes.
 */
const parseMiCodeList = (csv: string): string[] =>
  csv.split(',').map((value) => value.trim());

/** MI Code cells from the report table. */
const TheMiCodeCells = (): QuestionAdapter<string[]> =>
  Question.about(
    'the report list MI codes, in rendered order',
    async (actor) => {
      return actor.answer(Text.ofAll(StandardBomReportsPage.miCodeCells()));
    },
  );

/** Sorted MI Code cells for order-independent assertions. */
const SortedMiCodeCells = (): QuestionAdapter<string[]> =>
  Question.about('the report list MI codes, sorted', async (actor) => {
    const values = await actor.answer(
      Text.ofAll(StandardBomReportsPage.miCodeCells()),
    );
    return [...values].sort();
  });

export const ViewStandardBomReportList = {
  /** "سینا لیست آنالیز های استاندارد را بدون فیلتر مشاهده می کند" */
  unfiltered: (): Task =>
    Task.where(
      '#actor views the standard BOM report list, without any filter',
      LocateStandardBomReportPage(),
    ),

  /** The Scenario Outline's "با انتخاب مقادیر ... برای فیلتر ..." step. */
  filteredBySelectingValuesFor: (field: string, values: string[]): Task =>
    Task.where(
      d`#actor views the standard BOM report list, filtering "${field}"`,
      LocateStandardBomReportPage(),
      SelectOnlyTheseValuesFor(field, values),
    ),

  /** "با انتخاب مقادیر زیر" — the combination-of-fields example. */
  filteredByCombination: (
    filters: Array<{ field: string; values: string[] }>,
  ): Task =>
    Task.where(
      '#actor views the standard BOM report list, filtering by a combination of fields',
      LocateStandardBomReportPage(),
      ...filters.map(({ field, values }) =>
        SelectOnlyTheseValuesFor(field, values),
      ),
    ),

  /** "با عدم انتخاب مقدار ... برای فیلتر ..." */
  withValueDeselectedFor: (field: string, value: string): Task =>
    Task.where(
      d`#actor views the standard BOM report list, deselecting "${value}" from "${field}"`,
      LocateStandardBomReportPage(),
      DeselectValueFor(field, value),
    ),

  /** "با عدم انتخاب همه مقادیر فیلتر ..." — unchecking the master checkbox clears every value. */
  withAllValuesDeselectedFor: (field: string): Task =>
    Task.where(
      d`#actor views the standard BOM report list, deselecting every value of "${field}"`,
      LocateStandardBomReportPage(),
      Click.on(StandardBomReportsPage.columnFilterButton(field)),
      Click.on(StandardBomReportsPage.filterSelectAllCheckbox()),
      Click.on(StandardBomReportsPage.applyFilterButton()),
      WaitForTheFilterPanelToClose(),
    ),

  /** Sorts by product name ascending (default). */
  sortedByProductNameAsc: (): Task =>
    Task.where(
      '#actor views the standard BOM report list, sorted by product name ascending',
      LocateStandardBomReportPage(),
      SortByProductName('asc'),
    ),

  /** Sorts by product name descending. */
  sortedByProductNameDesc: (): Task =>
    Task.where(
      '#actor views the standard BOM report list, sorted by product name descending',
      LocateStandardBomReportPage(),
      SortByProductName('desc'),
    ),
};

/** "انتظار می رود آنالیز های استاندارد به ترتیب زیر نمایش داده شود" */
export const EnsureStandardBomsShownInOrder = (miCodes: string[]): Task =>
  Task.where(
    '#actor ensures the standard BOMs are shown in the expected order',
    Ensure.that(TheMiCodeCells(), equals(miCodes)),
  );

/** "انتظار می رود فقط آنالیز های استاندارد با کد MI «...» نمایش داده شود" — CSV list, order-independent. */
export const EnsureOnlyStandardBomsWithMiCodesShown = (csv: string): Task =>
  Task.where(
    d`#actor ensures only the standard BOMs "${csv}" are shown`,
    Ensure.that(SortedMiCodeCells(), equals([...parseMiCodeList(csv)].sort())),
  );

/** "انتظار می رود تمام آنالیز های استاندارد ثبت شده نمایش داده شود" — order-independent. */
export const EnsureAllRegisteredStandardBomsAreShown = (
  registeredMiCodes: string[],
): Task =>
  Task.where(
    '#actor ensures every registered standard BOM is shown',
    Ensure.that(SortedMiCodeCells(), equals([...registeredMiCodes].sort())),
  );

/** "انتظار می رود لیست فقط شامل ستون های زیر باشد" */
export const EnsureReportColumnsAreExactly = (columns: string[]): Task =>
  Task.where(
    '#actor ensures the report list shows exactly the expected columns',
    Ensure.that(
      Text.ofAll(StandardBomReportsPage.columnHeaders()),
      equals(columns),
    ),
  );

/** "انتظار می رود وزن مواد اولیه در فیلدهای قابل فیلتر نمایش داده نشود" */
export const EnsureMaterialWeightIsNotAFilterableField = (): Task =>
  Task.where(
    '#actor ensures material weight is not a filterable field',
    Ensure.that(
      StandardBomReportsPage.columnFilterButton('وزن مواد اولیه'),
      not(isPresent()),
    ),
  );

/** "همه مقادیر فیلتر ... را دوباره انتخاب می کند" — re-checking "select all" clears the filter. */
export const ReselectAllValuesFor = (field: string): Task =>
  Task.where(
    d`#actor reselects every value of "${field}"`,
    Click.on(StandardBomReportsPage.columnFilterButton(field)),
    Click.on(StandardBomReportsPage.filterSelectAllCheckbox()),
    Click.on(StandardBomReportsPage.applyFilterButton()),
    WaitForTheFilterPanelToClose(),
  );

/**
 * The identity "کاربری که وارد سیستم نشده" (an anonymous, never-logged-in visitor).
 * Mirrors `screenplay/bom-reporting/bom-report-list.ts#anonymousVisitorActorName`.
 */
export const anonymousVisitorActorName = 'کاربر مهمان';

/** "کاربری که وارد سیستم نشده تلاش می کند لیست آنالیز های استاندارد را مشاهده کند" */
export const AttemptToViewStandardBomReportListWithoutLoggingIn = (): Task =>
  Task.where(
    '#actor attempts to view the standard BOM report list without logging in',
    Navigate.to('/standard-boms/report'),
  );
