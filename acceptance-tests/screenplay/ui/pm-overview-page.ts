import { By, PageElement, PageElements } from '@serenity-js/web';

/**
 * Lean Page Object for `/pm-schedule/overview` («وضعیت تعمیرات و نگهداری» under «فنی» — issue
 * #69): every occurrence so far of every active plan item, with its status, who did it and when.
 * Locates elements and reports what they say — nothing else; the behaviour lives in
 * `screenplay/maintenance-management/pm-schedule.ts`.
 *
 * Every locator is confirmed against the source
 * (`frontend/src/app/features/pm-schedule/pm-overview-page.ts`), not yet against a rendered page.
 * As on the daily list, the table is drawn even when empty. «زمان انجام» is shown in the viewer's
 * time zone, so the suite never compares it here — the history facts read `performedAt` over the
 * API and render it in Tehran time themselves. The table is read **by column header** — «تجهیز», «فعالیت», «موعد», «وضعیت», «انجام دهنده», «زمان انجام» — header text is
 * **not gated** by the accessibility check.
 */
const table = () =>
  PageElement.located(By.css('table')).describedAs('PM overview table');

export const PmOverviewPage = {
  /** The page's `<h1>` is the menu label. */
  heading: () =>
    PageElement.located(
      By.role('heading', {
        name: 'وضعیت تعمیرات و نگهداری',
        level: 1,
        exact: true,
      }),
    ).describedAs('PM overview heading'),

  /** As on the daily list, a `role="progressbar"` while the rows load. */
  loadingIndicator: () =>
    PageElement.located(By.css('[role="progressbar"]')).describedAs(
      'PM overview loading indicator',
    ),

  /** A native `<table mat-table>`; header cells are `<th>`. Structural, ungated. */
  columnHeaders: () =>
    PageElements.located(By.css('thead th'))
      .of(table())
      .describedAs('PM overview column headers'),

  /** One body row per occurrence. Structural, ungated. */
  rows: () =>
    PageElements.located(By.css('tbody tr.mat-mdc-row'))
      .of(table())
      .describedAs('PM overview rows'),

  /** The cells of one row — scope with `.of(row)`. Structural, ungated. */
  rowCells: () =>
    PageElements.located(By.css('td')).describedAs('PM overview row cells'),
};
