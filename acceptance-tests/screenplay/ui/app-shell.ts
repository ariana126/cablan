import { By, PageElement } from '@serenity-js/web';

/**
 * Lean Page Object for the shell every signed-in page renders inside
 * (`frontend/src/app/ui/app-shell/app-shell.ts`) — the toolbar and the navigation drawer, not any
 * one page's content. Locates elements and reports what they say — nothing else.
 *
 * The log-out control lives here rather than on a page object of its own because the shell draws
 * it once for the whole app; a scenario logs out from wherever it happens to be standing.
 */
export const AppShell = {
  logOutButton: () =>
    PageElement.located(
      By.role('button', { name: 'خروج از سیستم', exact: true }),
    ).describedAs('log out button'),
};
