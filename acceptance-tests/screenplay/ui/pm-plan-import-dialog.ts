import { By, PageElement, PageElements } from '@serenity-js/web';

/**
 * The dialog `/pm-plans`' «بارگذاری از اکسل» opens (issue #127): the system's check of the uploaded
 * PM-plan workbook, then — after «تایید» — what the import added. Every locator is an ASSUMPTION
 * until the frontend builds it, taken from the dispatch's contract
 * (`docs/superpowers/plans/2026-11-19-pm-plan-import.md`, «Frontend»):
 *
 * - a `mat-dialog` (role `dialog`; its title is not pinned, so it is found as *the* open dialog);
 * - a line «N برنامه قابل ثبت است» (read from the dialog's text, not located);
 * - the errors table, columns «شیت», «خانه», «ردیف», «ستون», «مقدار», «علت» — told from the
 *   other tables by its «علت» column, since its section heading is not pinned;
 * - an «از قبل موجود» section — a `region` named by its heading — holding a table with at least
 *   «تجهیز» and «فعالیت» columns;
 * - an «اختلاف با برنامه موجود» table, columns «تجهیز», «فعالیت», «اختلاف» (cell «دوره», «اولین
 *   موعد», or «دوره و اولین موعد») — told apart by its «اختلاف» column;
 * - buttons «تایید» (disabled while the file has errors), «انصراف», and after the confirmation
 *   «بستن».
 *
 * Locates elements and reports what they say — nothing else; the behaviour lives in
 * `screenplay/maintenance-management/pm-plan-import.ts`. The tables are structural anchors
 * (`table`, `thead th`, `tbody tr`, `td`), **not protected by the accessibility gate**.
 */
const dialog = () =>
  PageElement.located(By.role('dialog')).describedAs('PM plan import dialog');

const buttonNamed = (name: string, description: string) =>
  PageElement.located(By.role('button', { name, exact: true }))
    .of(dialog())
    .describedAs(description);

export const PmPlanImportDialog = {
  dialog,

  /** ASSUMPTION: «تایید» — disabled while the check found errors. */
  confirmButton: () => buttonNamed('تایید', 'confirm PM plan import button'),

  /** ASSUMPTION: «انصراف», on the check before the confirmation. */
  cancelButton: () => buttonNamed('انصراف', 'cancel PM plan import button'),

  /** ASSUMPTION: «بستن», drawn once the import's result is shown. */
  closeButton: () => buttonNamed('بستن', 'close PM plan import button'),

  /** ASSUMPTION: a refusal of the confirmation is shown as the dialog's `role="alert"`. */
  alert: () =>
    PageElement.located(By.role('alert'))
      .of(dialog())
      .describedAs('PM plan import dialog alert'),

  /** Every table in the dialog — errors, already existing, conflicts — in rendered order. */
  tables: () =>
    PageElements.located(By.css('table'))
      .of(dialog())
      .describedAs('PM plan import tables'),

  /** ASSUMPTION: the «از قبل موجود» section, a `region` named by its heading. */
  alreadyExistingTables: () =>
    PageElements.located(By.css('table'))
      .of(
        PageElement.located(
          By.role('region', { name: 'از قبل موجود', exact: true }),
        ).of(dialog()),
      )
      .describedAs('already existing PM plan items table'),

  /** One table's header cells. */
  columnHeadersOf: (table: PageElement) =>
    PageElements.located(By.css('thead th'))
      .of(table)
      .describedAs('PM plan import table column headers'),

  /** One table's body rows. */
  rowsOf: (table: PageElement) =>
    PageElements.located(By.css('tbody tr'))
      .of(table)
      .describedAs('PM plan import table rows'),

  /** The cells of one row — scope with `.of(row)`. */
  rowCells: () =>
    PageElements.located(By.css('td')).describedAs('PM plan import cells'),
};
