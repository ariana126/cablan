import { includes, not } from '@serenity-js/assertions';
import { By, PageElement, PageElements, Text } from '@serenity-js/web';
import { JalaliDateTimeField } from './jalali-datetime-field';

const OVERFLOW_TEXT = 'مورد دیگر';

/**
 * Lean Page Object for `/pm-schedule/overview` — «برنامه PM» under «فنی» (issue #90; «گزارش PM»
 * before it): every PM occurrence in a date range, past or future, as a Jalali month **calendar**
 * (the default view) or a **table** with a due-date range, under four shared filters. Locates
 * elements and reports what they say — nothing else; the behaviour lives in
 * `screenplay/maintenance-management/pm-schedule-overview.ts`.
 *
 * ASSUMPTION — issue #90's page is written after this file, so every locator below is a contract
 * the frontend is asked to meet (design: `docs/superpowers/specs/2026-11-01-pm-schedule-calendar-design.md`),
 * not something seen in a rendered page. A timeout here is the first thing to check against the
 * screenshot in the living documentation.
 *
 * Unchanged from issue #69/#80: the table is a native `<table mat-table>` read **by column header**
 * — «تجهیز», «فعالیت», «موعد», «وضعیت», «مقدار تاخیر», «انجام دهنده», «زمان انجام» — header
 * text is **not gated** by the accessibility check. «مقدار تاخیر» reads «N روز» for a late
 * occurrence and «-» otherwise. Rows come in the backend's order (equipment, plan order, due date)
 * and the table is **not paginated** (ASSUMPTION), so every row of the range is in the DOM.
 */
const table = () =>
  PageElement.located(By.css('table')).describedAs('PM schedule table');

/**
 * A `mat-select` is an ARIA `combobox` named by its `mat-label` — but once it holds a value,
 * Material adds the value's id to `aria-labelledby`, so the name reads «تجهیز همه». Matched as the
 * label followed by nothing or by whitespace.
 */
const startingWith = (text: string): RegExp =>
  new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`);

const filterSelect = (label: string) =>
  PageElement.located(
    By.role('combobox', { name: startingWith(label) }),
  ).describedAs(`«${label}» filter`);

/**
 * ASSUMPTION: the calendar view is one landmark — a `<section aria-label="تقویم PM">` (role
 * `region`) — holding the month's title, its navigation and its days. The view switch's
 * «تقویم PM» toggle has role `radio`, so the two never collide.
 */
const calendar = () =>
  PageElement.located(
    By.role('region', { name: 'تقویم PM', exact: true }),
  ).describedAs('PM calendar');

/** ASSUMPTION: a `mat-dialog` — `role="dialog"`. At most one is open at a time on this page. */
const openDialog = () =>
  PageElement.located(By.role('dialog')).describedAs('open dialog');

export const PmOverviewPage = {
  /** The page's `<h1>` is the menu label. */
  heading: () =>
    PageElement.located(
      By.role('heading', { name: 'برنامه PM', level: 1, exact: true }),
    ).describedAs('PM schedule heading'),

  /**
   * ASSUMPTION: the view switch is a single-selection `mat-button-toggle-group` whose toggles
   * Material renders as `role="radio"` buttons named «تقویم PM» and «جدول PM», calendar first and
   * checked by default.
   */
  viewToggle: (name: 'تقویم PM' | 'جدول PM') =>
    PageElement.located(By.role('radio', { name, exact: true })).describedAs(
      `«${name}» view toggle`,
    ),

  /**
   * As on the daily list, a `role="progressbar"` while either view's rows load, removed once they —
   * possibly none — are in. ASSUMPTION: shown in the same render that changes the range, month or
   * filter, so "no progress bar" means "the rows on screen answer the current choice".
   */
  loadingIndicator: () =>
    PageElement.located(By.css('[role="progressbar"]')).describedAs(
      'PM schedule loading indicator',
    ),

  // --- The shared filters ----------------------------------------------------------------------

  /**
   * ASSUMPTION: four `mat-select`s labelled «تجهیز», «فعالیت», «وضعیت» and «انجام دهنده», above
   * both views, each starting on «همه».
   */
  equipmentFilter: () => filterSelect('تجهیز'),
  activityFilter: () => filterSelect('فعالیت'),
  statusFilter: () => filterSelect('وضعیت'),
  performerFilter: () => filterSelect('انجام دهنده'),

  /** ASSUMPTION: a button «پاک کردن فیلترها» puts all four back on «همه». */
  clearFiltersButton: () =>
    PageElement.located(
      By.role('button', { name: 'پاک کردن فیلترها', exact: true }),
    ).describedAs('clear filters button'),

  /** An option of whichever `mat-select` is open — «همه», or a performer's display name. */
  option: (name: string) =>
    PageElement.located(By.role('option', { name, exact: true })).describedAs(
      `«${name}» option`,
    ),

  /**
   * ASSUMPTION: an equipment option is named by the equipment's name, which a retired one follows
   * with a mark of its own after whitespace («اکسترودر 1 (کنار گذاشته شده)», say) — so it is
   * matched as starting with the name.
   */
  equipmentOption: (equipmentName: string) =>
    PageElement.located(
      By.role('option', { name: startingWith(equipmentName) }),
    ).describedAs(`«${equipmentName}» equipment option`),

  // --- The table view --------------------------------------------------------------------------

  /**
   * ASSUMPTION: the table's range is two date-only `app-jalali-datetime-field`s — read-only
   * textboxes labelled «از تاریخ» and «تا تاریخ», whose calendar toggles are «باز کردن تقویم از
   * تاریخ» / «باز کردن تقویم تا تاریخ» (bound name = label, as for the PM plan's «اولین موعد»).
   * Changing either reloads the table; there is no apply button.
   */
  fromDateField: () =>
    JalaliDateTimeField.labelled({
      dateLabel: 'از تاریخ',
      timeLabel: 'ساعت از تاریخ',
      boundName: 'از تاریخ',
    }),

  toDateField: () =>
    JalaliDateTimeField.labelled({
      dateLabel: 'تا تاریخ',
      timeLabel: 'ساعت تا تاریخ',
      boundName: 'تا تاریخ',
    }),

  /** ASSUMPTION: a button «ماه جاری» puts the range back on the current Jalali month. */
  currentMonthButton: () =>
    PageElement.located(
      By.role('button', { name: 'ماه جاری', exact: true }),
    ).describedAs('current month button'),

  /** Header cells are `<th>`. Structural, ungated. */
  columnHeaders: () =>
    PageElements.located(By.css('thead th'))
      .of(table())
      .describedAs('PM schedule column headers'),

  /** One body row per occurrence. Structural, ungated. */
  rows: () =>
    PageElements.located(By.css('tbody tr.mat-mdc-row'))
      .of(table())
      .describedAs('PM schedule rows'),

  /** The cells of one row — scope with `.of(row)`. Structural, ungated. */
  rowCells: () =>
    PageElements.located(By.css('td')).describedAs('PM schedule row cells'),

  // --- The calendar view -----------------------------------------------------------------------

  calendar,

  /**
   * ASSUMPTION: the month shown is the calendar's `<h2>`, its Jalali month name and year —
   * «دی ۱۴۰۵» (Persian or Latin digits).
   */
  monthTitle: () =>
    PageElement.located(By.role('heading', { level: 2 }))
      .of(calendar())
      .describedAs('PM calendar month title'),

  /** ASSUMPTION: buttons «ماه قبل», «ماه بعد» and «امروز» inside the calendar landmark. */
  previousMonthButton: () =>
    PageElement.located(By.role('button', { name: 'ماه قبل', exact: true }))
      .of(calendar())
      .describedAs('previous month button'),

  nextMonthButton: () =>
    PageElement.located(By.role('button', { name: 'ماه بعد', exact: true }))
      .of(calendar())
      .describedAs('next month button'),

  todayButton: () =>
    PageElement.located(By.role('button', { name: 'امروز', exact: true }))
      .of(calendar())
      .describedAs('today button'),

  /**
   * ASSUMPTION: every day **of the month shown** is a `role="group"` whose `aria-label` is its
   * Jalali date, `YYYY/MM/DD` (Persian or Latin digits, zero padding optional — «۱۴۰۵/۱۰/۴»
   * reads as 1405/10/04). The grid's padding cells from the neighbouring months carry neither, so
   * they are not counted. In rendered (chronological) order. Structural, ungated.
   */
  calendarDays: () =>
    PageElements.located(By.css('[role="group"][aria-label]'))
      .of(calendar())
      .describedAs('PM calendar days'),

  /**
   * ASSUMPTION: each of a day's occurrences (at most three) is a `role="button"` chip — its text
   * «اکسترودر 1 · تعویض روغن» and the status word — that opens the details dialog. Every button
   * of the day but its «+N مورد دیگر».
   */
  dayEntries: (day: PageElement) =>
    PageElements.located(By.role('button'))
      .of(day)
      .where(Text, not(includes(OVERFLOW_TEXT)))
      .describedAs('PM calendar day entries'),

  /** ASSUMPTION: a day with more than three occurrences ends in a «+N مورد دیگر» button. */
  dayOverflowButtons: (day: PageElement) =>
    PageElements.located(By.role('button'))
      .of(day)
      .where(Text, includes(OVERFLOW_TEXT))
      .describedAs('PM calendar day overflow button'),

  // --- The details dialog ----------------------------------------------------------------------

  openDialog,

  /**
   * ASSUMPTION: the details dialog lists its facts as a `<dl>`: one `<dt>` label and one `<dd>`
   * value each — «تجهیز», «فعالیت», «موعد» (the original due date), «زمان انجام», «وضعیت»,
   * «مقدار تاخیر» («N روز»), «انجام دهنده», «توضیحات», with «—» for an absent value. Read pairwise
   * in rendered order. Structural, ungated.
   */
  detailLabels: () =>
    PageElements.located(By.css('dl dt'))
      .of(openDialog())
      .describedAs('occurrence detail labels'),

  detailValues: () =>
    PageElements.located(By.css('dl dd'))
      .of(openDialog())
      .describedAs('occurrence detail values'),

  /** ASSUMPTION: the details dialog closes through a button «بستن». */
  closeDialogButton: () =>
    PageElement.located(By.role('button', { name: 'بستن', exact: true }))
      .of(openDialog())
      .describedAs('close dialog button'),
};
