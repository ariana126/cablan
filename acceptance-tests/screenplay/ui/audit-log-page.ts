import { By, PageElement, PageElements } from '@serenity-js/web';

/**
 * ASSUMPTION (issue #74, not built yet): the details dialog of a bulk-import («بارگذاری گروهی»)
 * entry — a `mat-dialog` (role `dialog`) titled «جزئیات تغییرات بارگذاری گروهی», after the
 * existing dialog's «جزئیات تغییرات <record type label>» heading
 * (`audit-log-changes-dialog.ts`) and the record-type label «بارگذاری گروهی» the import plan
 * gives `MaterialImport`.
 */
const importDetailsDialog = () =>
  PageElement.located(
    By.role('dialog', {
      name: 'جزئیات تغییرات بارگذاری گروهی',
      exact: true,
    }),
  ).describedAs('bulk-import details dialog');

/**
 * Lean Page Object for `/audit-log` (`frontend/src/app/features/audit-log/audit-log-page.ts`), from
 * the audit-logging feature area's side. Locates elements and reports what they say — nothing
 * else; the behaviour that uses them lives in
 * `screenplay/audit-logging/material-import-audit.ts`. The rest of viewing-audit-log.feature reads
 * the audit log over HTTP and has never needed this page.
 */
export const AuditLogPage = {
  /** The page's one `<h1>`, from `app-page-header`'s `heading` input. */
  heading: () =>
    PageElement.located(
      By.role('heading', { name: 'رویداد های سیستم', level: 1, exact: true }),
    ).describedAs('page heading'),

  /**
   * A row's «جزئیات» button, whose accessible name carries the record id
   * (`[attr.aria-label]="'جزئیات تغییرات ' + row.recordId"`). An import and its reversion share one
   * record id, so once an import has been reverted two rows answer to the name; the list is newest
   * first, so `.last()` is the older one — the import itself.
   */
  detailsButtonFor: (recordId: string) =>
    PageElements.located(
      By.role('button', { name: `جزئیات تغییرات ${recordId}`, exact: true }),
    )
      .last()
      .describedAs(`details button for record ${recordId}`),

  /** See the module-level `importDetailsDialog` above. */
  importDetailsDialog,

  /**
   * ASSUMPTION (issue #74): the «برگرداندن» action an `Imported` entry's details dialog offers the
   * system admin. Assumed to revert straight away — no second confirmation dialog — and to
   * disappear (or the dialog to close) once the reversion has succeeded.
   */
  revertButton: () =>
    PageElement.located(By.role('button', { name: 'برگرداندن', exact: true }))
      .of(importDetailsDialog())
      .describedAs('revert button'),

  /**
   * ASSUMPTION (issue #74): where a refused reversion (409) is reported in the open dialog — a
   * `role="alert"` element, like `app-error-banner`.
   */
  revertError: () =>
    PageElement.located(By.role('alert'))
      .of(importDetailsDialog())
      .describedAs('reversion error message'),
};
