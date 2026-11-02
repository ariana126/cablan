import { By, PageElement } from '@serenity-js/web';

/**
 * Lean Page Object for the one thing every form and confirmation dialog of the app shares: the
 * banner it shows when the site refuses what the visitor asked (`app-error-banner`, a
 * `role="alert"` element rendered inside the dialog). It is the same widget on every page, so it
 * lives here once rather than on each page's object — the same reason `app-shell.ts` exists.
 *
 * Scoped to the open `mat-dialog` (role `dialog`): while one is open the CDK overlay hides the page
 * behind it from role locators anyway, and the scope keeps a page-level banner (a list that failed
 * to load) from ever being read as the dialog's answer.
 *
 * Confirmed against the frontend (issue #94): a refused edit or delete of a record that other
 * records use (409 `record-has-dependents`) is told in this banner, in the still-open dialog, as a
 * Persian sentence built from the response's `dependents` — e.g. «امکان حذف این اطلاعات وجود ندارد،
 * زیرا در ۱ محصول («کابل NYY») استفاده شده است.» Counts are written in Persian digits, which the
 * domain layer reads back as Latin (`common/record-dependents.ts`).
 */
export const OpenDialog = {
  alert: () =>
    PageElement.located(By.role('alert'))
      .of(PageElement.located(By.role('dialog')))
      .describedAs("the open dialog's alert"),
};
