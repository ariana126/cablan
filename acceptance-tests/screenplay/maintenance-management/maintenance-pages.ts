import {
  Answerable,
  Interaction,
  notes,
  Question,
  QuestionAdapter,
  Task,
  Wait,
} from '@serenity-js/core';
import { isGreaterThan, isPresent, isTrue, not } from '@serenity-js/assertions';
import {
  isVisible,
  Navigate,
  PageElement,
  PageElements,
  Text,
} from '@serenity-js/web';
import { AuthNotes, LogIn } from '../common/login';
import { PersonaCredentialsNotes } from '../common/personas';
import { EquipmentPage } from '../ui/equipment-page';
import { MaintenanceActivitiesPage } from '../ui/maintenance-activities-page';
import { PmPlansPage } from '../ui/pm-plans-page';
import { DailyPmSchedulePage } from '../ui/daily-pm-schedule-page';
import { PmOverviewPage } from '../ui/pm-overview-page';
import { PmDashboardPage } from '../ui/pm-dashboard-page';
import { SpecialtyAssignmentDialog } from '../ui/specialty-assignment-dialog';

/**
 * Getting to the six maintenance pages, waiting for them, and reading what their tables say. The
 * locate tasks are where the waiting belongs (`acceptance-tests/CLAUDE.md`, "Waiting, and where it
 * belongs"), and each starts a real browser session first: a background's «… وارد سیستم شده باشد»
 * only authenticates the actor's API ability (`bom-registration/materials-form.ts` explains).
 */

/**
 * Logs in through `/login` with the credentials `LogInAsPersona` noted — which also puts the
 * browser on the system's clock, so a session issued at a frozen 1405 instant is not thrown away by
 * a browser living in today (`common/clock.ts#SyncBrowserClockWithTheSystem`).
 */
const EstablishBrowserSession = (): Task =>
  Task.where(
    '#actor establishes a browser session',
    LogIn.using(
      notes<AuthNotes>().get('username'),
      notes<PersonaCredentialsNotes>().get('password'),
    ),
  );

const LocatePage = (
  description: string,
  path: string,
  heading: Answerable<PageElement>,
): Task =>
  Task.where(
    description,
    EstablishBrowserSession(),
    Navigate.to(path),
    Wait.until(heading, isVisible()),
  );

export const LocateEquipmentPage = (): Task =>
  LocatePage(
    '#actor locates the equipment page',
    '/equipment',
    EquipmentPage.heading(),
  );

export const LocateMaintenanceActivitiesPage = (): Task =>
  LocatePage(
    '#actor locates the maintenance activities page',
    '/maintenance-activities',
    MaintenanceActivitiesPage.heading(),
  );

export const LocatePmPlansPage = (): Task =>
  LocatePage(
    '#actor locates the PM plans page',
    '/pm-plans',
    PmPlansPage.heading(),
  );

/**
 * A list page has loaded when its table is drawn and its loading indicator is gone — without that,
 * an empty list cannot be told from one whose rows are still on their way, and «… در برنامه
 * روزانه نباشد» would pass vacuously.
 */
export const WaitForTheListToLoad = (
  columnHeaders: PageElements,
  loadingIndicator: Answerable<PageElement>,
): Task =>
  Task.where(
    '#actor waits for the list to load',
    Wait.until(columnHeaders.count(), isGreaterThan(0)),
    Wait.until(loadingIndicator, not(isPresent())),
  );

/**
 * The daily list has loaded once nothing is loading and it shows either its tables (one per group —
 * issue #108 groups it by equipment and specialty) or its "no work today" message. Grouping means an
 * empty day may draw no table at all, so the message is what tells "empty" from "not loaded yet".
 */
export const LocateDailyPmSchedulePage = (): Task =>
  Task.where(
    '#actor locates the daily PM schedule',
    LocatePage(
      '#actor opens the daily PM schedule',
      '/pm-schedule/daily',
      DailyPmSchedulePage.heading(),
    ),
    Wait.until(
      Question.about('whether the daily PM list has loaded', async (actor) => {
        const loading = await actor.answer(
          DailyPmSchedulePage.loadingIndicator(),
        );
        if (await loading.isPresent()) {
          return false;
        }
        const headers = await actor.answer(
          DailyPmSchedulePage.columnHeaders().count(),
        );
        if (headers > 0) {
          return true;
        }
        const noWork = await actor.answer(DailyPmSchedulePage.noWorkMessage());
        return noWork.isPresent();
      }),
      isTrue(),
    ),
  );

/**
 * The system admin's legacy specialty assignment (issue #108) opens by itself after a sign-in while
 * some activity has no specialty: signs in through `/login` and waits for it.
 */
export const LocateTheSpecialtyAssignmentDialog = (): Task =>
  Task.where(
    '#actor locates the specialty assignment of earlier activities',
    EstablishBrowserSession(),
    Wait.until(SpecialtyAssignmentDialog.heading(), isVisible()),
  );

/**
 * `/pm-schedule/overview` («برنامه PM») opens on its calendar view (issue #90), so the locate task
 * waits for the heading and the view switch only; switching to the table, or turning the calendar
 * to a month, waits for that view's own rows (`pm-schedule-overview.ts`).
 */
export const LocatePmOverviewPage = (): Task =>
  Task.where(
    '#actor locates the PM schedule',
    LocatePage(
      '#actor opens the PM schedule',
      '/pm-schedule/overview',
      PmOverviewPage.heading(),
    ),
    Wait.until(PmOverviewPage.viewToggle('جدول PM'), isVisible()),
  );

/**
 * `/pm-dashboard` («داشبورد مدیریتی فنی», issue #89) has loaded once its heading is drawn, its
 * first card is on screen and nothing is loading — the cards show the dashboard's answer, not a
 * placeholder.
 */
export const LocatePmDashboardPage = (): Task =>
  Task.where(
    '#actor locates the technical management dashboard',
    LocatePage(
      '#actor opens the technical management dashboard',
      '/pm-dashboard',
      PmDashboardPage.heading(),
    ),
    Wait.until(PmDashboardPage.card('سررسید امروز'), isVisible()),
    Wait.until(PmDashboardPage.loadingIndicator(), not(isPresent())),
  );

/**
 * Submitting a dialog means clicking *and* waiting for the answer: polls until `openWhile` is no
 * longer visible (the dialog closed — the request succeeded) or any of `refusals` is (the site said
 * what was wrong). A manual poll, as `common/login.ts` explains, because either outcome may come.
 */
export const WaitForTheDialogToBeAnswered = (
  openWhile: Answerable<PageElement>,
  ...refusals: Answerable<PageElement>[]
): Interaction =>
  Interaction.where(
    '#actor waits for the dialog to be answered',
    async (actor) => {
      const deadline = Date.now() + 5_000;
      do {
        const stillOpen = await actor.answer(openWhile);
        if (!(await stillOpen.isVisible())) {
          return;
        }
        for (const refusal of refusals) {
          const message = await actor.answer(refusal);
          if (await message.isVisible()) {
            return;
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      } while (Date.now() < deadline);
    },
  );

/** Persian and Arabic-Indic digits as Latin ones. */
const withLatinDigits = (text: string): string =>
  text
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660));

/**
 * A cell as the Gherkin writes it: bidi marks removed, whitespace collapsed, digits Latin (the
 * frontend renders dates and counts in Persian digits) and a Jalali date zero-padded, so
 * «۱۴۰۵/۷/۱۵» reads «1405/07/15».
 */
export const asTheGherkinWritesIt = (text: string): string =>
  withLatinDigits(text)
    .replace(/[‎‏؜‪-‮⁦-⁩]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(
      /\b(\d{4})\/(\d{1,2})\/(\d{1,2})\b/g,
      (_match, year: string, month: string, day: string) =>
        `${year}/${month.padStart(2, '0')}/${day.padStart(2, '0')}`,
    );

export interface ListTable {
  columnHeaders: () => PageElements;
  rows: () => PageElements;
  rowCells: () => PageElements;
}

export type ListRow = Record<string, string>;

/**
 * Every body row of a list page's table, in rendered order, each keyed by its column's header
 * text — so a step compares only the columns the Gherkin names, whatever order the page shows them
 * in and whatever else (an actions column) it shows.
 */
export const TheRowsOf = (
  description: string,
  table: ListTable,
): QuestionAdapter<ListRow[]> =>
  Question.about(description, async (actor) => {
    const headers = (await actor.answer(Text.ofAll(table.columnHeaders()))).map(
      asTheGherkinWritesIt,
    );
    const rows = await actor.answer(table.rows());
    const read: ListRow[] = [];
    for (const row of rows) {
      const cells = (
        await actor.answer(Text.ofAll(table.rowCells().of(row)))
      ).map(asTheGherkinWritesIt);
      read.push(
        Object.fromEntries(
          headers.map((header, index) => [header, cells[index] ?? '']),
        ),
      );
    }
    return read;
  });

/** A page that shows its rows in several tables, each with its own header row. */
export interface GroupedListTables {
  tables: () => PageElements;
  columnHeadersOf: (table: PageElement) => PageElements;
  rowsOf: (table: PageElement) => PageElements;
  rowCells: () => PageElements;
}

/**
 * Every body row of every table on the page, in rendered order, each keyed by **its own** table's
 * column headers — for a list split into groups (the daily PM list, issue #108).
 */
export const TheRowsOfEveryTable = (
  description: string,
  page: GroupedListTables,
): QuestionAdapter<ListRow[]> =>
  Question.about(description, async (actor) => {
    const read: ListRow[] = [];
    for (const table of await actor.answer(page.tables())) {
      const headers = (
        await actor.answer(Text.ofAll(page.columnHeadersOf(table)))
      ).map(asTheGherkinWritesIt);
      for (const row of await actor.answer(page.rowsOf(table))) {
        const cells = (
          await actor.answer(Text.ofAll(page.rowCells().of(row)))
        ).map(asTheGherkinWritesIt);
        read.push(
          Object.fromEntries(
            headers.map((header, index) => [header, cells[index] ?? '']),
          ),
        );
      }
    }
    return read;
  });

/** `rows` reduced to the columns `expected` names, for an exact comparison. */
export const onlyTheColumnsOf = (
  expected: ListRow[],
  rows: ListRow[],
): ListRow[] => {
  const columns = Object.keys(expected[0] ?? {});
  return rows.map((row) =>
    Object.fromEntries(columns.map((column) => [column, row[column] ?? ''])),
  );
};
