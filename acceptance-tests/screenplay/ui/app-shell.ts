import { By, PageElement } from '@serenity-js/web';

/**
 * Lean Page Object for the shell every signed-in page renders inside
 * (`frontend/src/app/ui/app-shell/app-shell.ts`) — the toolbar and the navigation drawer, not any
 * one page's content. Locates elements and reports what they say — nothing else.
 *
 * The log-out control lives here rather than on a page object of its own because the shell draws
 * it once for the whole app; a scenario logs out from wherever it happens to be standing. It sits
 * behind the account button, which opens a menu holding «خروج از سیستم».
 */
export const AppShell = {
  /**
   * The account button in the toolbar. Its accessible name is «حساب کاربری: {name}، {role}», so it
   * is found by the fixed prefix of that name: Serenity's role locator compares a name whole, and
   * the person and their role are not this page object's business.
   */
  accountButton: () =>
    PageElement.located(
      By.css('mat-toolbar button[aria-label^="حساب کاربری"]'),
    ).describedAs('account button'),

  logOutMenuItem: () =>
    PageElement.located(
      By.role('menuitem', { name: 'خروج از سیستم', exact: true }),
    ).describedAs('log out menu item'),
};
