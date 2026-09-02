import { By, PageElement } from '@serenity-js/web';

/**
 * Lean Page Object for `/users` (`frontend/src/app/features/users/users-page.ts`). Locates
 * elements and reports what they say — nothing else. The log-out control the login feature drives
 * is not here: the shell draws it on every page, so it lives on `screenplay/ui/app-shell.ts`.
 */
export const UsersPage = {
  heading: () =>
    PageElement.located(
      By.role('heading', { name: 'مدیریت کاربران', level: 1, exact: true }),
    ).describedAs('page heading'),
};
