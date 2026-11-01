import { By, PageElement, PageElements } from '@serenity-js/web';

/**
 * Lean Page Object for `/pm-dashboard` — «داشبورد مدیریتی فنی», first page under «فنی» (issue
 * #89): today's PM state, the chosen period's missed occurrences and performance, plan coverage,
 * the most overdue equipment and the next seven days, for one equipment or all. Locates elements
 * and reports what they say — nothing else; the behaviour lives in
 * `screenplay/maintenance-management/pm-dashboard.ts`.
 *
 * ASSUMPTION — the page is written in parallel with this file, so every locator below is the
 * markup contract of `docs/superpowers/plans/2026-11-01-technical-management-dashboard.md`
 * ("Frontend → Markup contract") as this suite reads it, not something seen in a rendered page.
 * Where the contract leaves the markup open, the comment says what is assumed. A timeout here is the
 * first thing to check against the screenshot in the living documentation.
 *
 * Labels are matched **loosely**: every character may be followed by whitespace or a ZWNJ, and a
 * Latin digit matches its Persian twin — so «موعدهای ازدست رفته», «موعدهای از دست‌رفته» and
 * «۷ روز اخیر» all answer the Gherkin's spelling.
 */

const escaped = (character: string): string =>
  character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/** The text as a pattern tolerant of spacing, ZWNJ and Persian digits. */
const loosely = (text: string): string =>
  [...text.replace(/[\s‌]+/g, '')]
    .map((character) =>
      /[0-9]/.test(character)
        ? `[${character}${PERSIAN_DIGITS[Number(character)]}]`
        : escaped(character),
    )
    .join('[\\s\\u200c]*');

/** An accessible name that is exactly `text`, loosely. */
const named = (text: string): RegExp =>
  new RegExp(`^\\s*${loosely(text)}\\s*$`);

/**
 * An accessible name that starts with `text`, loosely, followed by nothing or whitespace — a
 * `mat-select`'s name once it holds a value («بازه زمانی 30 روز اخیر»), a card's name with its
 * number («سررسید امروز 1»), a retired equipment's option with its mark.
 */
const startingWith = (text: string): RegExp =>
  new RegExp(`^\\s*${loosely(text)}(\\s|$)`);

/**
 * ASSUMPTION: each panel is a landmark — a `<section>` named by its `<h2>` (`aria-labelledby`) or
 * an `aria-label` — so it has role `region` and the panel's title as its name.
 */
const region = (title: string) =>
  PageElement.located(By.role('region', { name: named(title) })).describedAs(
    `«${title}» panel`,
  );

const PERFORMANCE = 'عملکرد PM';
const COVERAGE = 'پوشش برنامه PM';
const MOST_OVERDUE = 'بیشترین عقب افتادگی';
const UPCOMING = 'برنامه هفت روز آینده';

/**
 * A panel's table. ASSUMPTION: a native `<table mat-table>`, header cells `<th>`, read **by
 * column header** — header text is not gated by the accessibility check. An empty panel may show
 * its empty-state message instead of the table, which reads as no rows.
 */
const tableOf = (title: string) => {
  const table = () =>
    PageElement.located(By.css('table'))
      .of(region(title))
      .describedAs(`«${title}» table`);
  return {
    columnHeaders: () =>
      PageElements.located(By.css('thead th'))
        .of(table())
        .describedAs(`«${title}» column headers`),
    /**
     * Body rows. Structural, ungated. `:not(.mat-mdc-no-data-row)` keeps a Material no-data row
     * from reading as data.
     */
    rows: () =>
      PageElements.located(By.css('tbody tr:not(.mat-mdc-no-data-row)'))
        .of(table())
        .describedAs(`«${title}» rows`),
    rowCells: () =>
      PageElements.located(By.css('td')).describedAs(`«${title}» row cells`),
  };
};

/**
 * ASSUMPTION: a panel's "labelled values" (the contract's words) are a description list — one
 * `<dt>` label and one `<dd>` value per figure, read pairwise in rendered order, as the PM
 * overview's details dialog does. Structural, ungated.
 */
const labelledValuesOf = (title: string) => ({
  labels: () =>
    PageElements.located(By.css('dl dt'))
      .of(region(title))
      .describedAs(`«${title}» labels`),
  values: () =>
    PageElements.located(By.css('dl dd'))
      .of(region(title))
      .describedAs(`«${title}» values`),
});

/** ASSUMPTION: a `mat-dialog` — `role="dialog"` — if «فاقد برنامه» opens its list in one. */
const openDialog = () =>
  PageElement.located(By.role('dialog')).describedAs('open dialog');

/**
 * A link to an equipment's technical file, `/pm-plans/:equipmentId` — the menu's own «برنامه PM»
 * link is `/pm-plans`, without the trailing segment, so it never matches. Structural, ungated.
 */
const TECHNICAL_FILE_LINKS = 'a[href^="/pm-plans/"]';

export const PmDashboardPage = {
  /** The page's `<h1>` is the menu label. */
  heading: () =>
    PageElement.located(
      By.role('heading', {
        name: 'داشبورد مدیریتی فنی',
        level: 1,
        exact: true,
      }),
    ).describedAs('technical management dashboard heading'),

  /**
   * ASSUMPTION: as on the other maintenance pages, a `role="progressbar"` while the dashboard's
   * one request is in flight — shown in the same render that changes the period or the equipment —
   * and removed once every panel holds the answer.
   */
  loadingIndicator: () =>
    PageElement.located(By.css('[role="progressbar"]')).describedAs(
      'dashboard loading indicator',
    ),

  // --- Filters -------------------------------------------------------------------------------

  /**
   * `mat-select`s, i.e. ARIA `combobox`es named by their `mat-label` (and, once they hold a
   * value, by the value too — hence "starting with").
   */
  periodFilter: () =>
    PageElement.located(
      By.role('combobox', { name: startingWith('بازه زمانی') }),
    ).describedAs('«بازه زمانی» filter'),

  equipmentFilter: () =>
    PageElement.located(
      By.role('combobox', { name: startingWith('تجهیز') }),
    ).describedAs('«تجهیز» filter'),

  /** A period option — «7 روز اخیر», «30 روز اخیر», «90 روز اخیر» — or «همه تجهیزات». */
  option: (name: string) =>
    PageElement.located(By.role('option', { name: named(name) })).describedAs(
      `«${name}» option`,
    ),

  /**
   * An equipment option, named by the equipment's name. ASSUMPTION: a retired one, if listed,
   * follows the name with a mark of its own after whitespace — so it is matched as starting with
   * the name.
   */
  equipmentOption: (equipmentName: string) =>
    PageElement.located(
      By.role('option', { name: startingWith(equipmentName) }),
    ).describedAs(`«${equipmentName}» equipment option`),

  // --- Current cards -------------------------------------------------------------------------

  /**
   * «سررسید امروز», «عقب افتاده», «انجام شده امروز», «موعدهای ازدست رفته»: each a button whose
   * accessible name starts with its title and holds its number. ASSUMPTION: the card's text is the
   * title followed by the number (and possibly a caption without digits), so the first number after
   * the title is the card's.
   */
  card: (title: string) =>
    PageElement.located(
      By.role('button', { name: startingWith(title) }),
    ).describedAs(`«${title}» card`),

  // --- Panels --------------------------------------------------------------------------------

  performancePanel: () => region(PERFORMANCE),
  performanceFigures: () => labelledValuesOf(PERFORMANCE),

  coveragePanel: () => region(COVERAGE),
  coverageFigures: () => labelledValuesOf(COVERAGE),

  /**
   * The coverage panel's «فاقد برنامه» button, which lists the equipment without a plan.
   * ASSUMPTION: its name starts with «فاقد برنامه» (a count may follow).
   */
  withoutPlanButton: () =>
    PageElement.located(
      By.role('button', { name: startingWith('فاقد برنامه') }),
    )
      .of(region(COVERAGE))
      .describedAs('«فاقد برنامه» button'),

  /**
   * The equipment «فاقد برنامه» lists, each a link named by the equipment to its technical file.
   * ASSUMPTION: listed inside the coverage panel (an expansion) — or, if a dialog is open, in that
   * dialog; the task reads whichever holds them.
   */
  withoutPlanLinksInThePanel: () =>
    PageElements.located(By.css(TECHNICAL_FILE_LINKS))
      .of(region(COVERAGE))
      .describedAs('equipment without a plan, in the coverage panel'),

  withoutPlanLinksInTheDialog: () =>
    PageElements.located(By.css(TECHNICAL_FILE_LINKS))
      .of(openDialog())
      .describedAs('equipment without a plan, in the dialog'),

  openDialog,

  mostOverduePanel: () => region(MOST_OVERDUE),
  /** Columns «تجهیز», «تعداد کار عقب افتاده», «جمع روزهای تاخیر». */
  mostOverdueTable: () => tableOf(MOST_OVERDUE),

  upcomingPanel: () => region(UPCOMING),
  /** Columns «تجهیز», «فعالیت», «موعد» (Jalali `yyyy/MM/dd`). */
  upcomingTable: () => tableOf(UPCOMING),
};
