import { By, PageElement } from '@serenity-js/web';

/**
 * Lean Page Object for `/users` (`frontend/src/app/features/users/users-page.ts`). Locates
 * elements and reports what they say — nothing else; the behaviour that uses them lives in
 * `screenplay/authentication/logging-in.ts`.
 */
export const UsersPage = {
  heading: () =>
    PageElement.located(
      By.role('heading', { name: 'مدیریت کاربران', level: 1, exact: true }),
    ).describedAs('page heading'),

  /**
   * The header's log-out control — see the dispatch this automation was written against:
   * "an accessible `<button>` whose visible/aria text is exactly 'خروج از سیستم'". New in the
   * same pass as this automation; expect this locator to find nothing until the frontend side
   * lands.
   */
  logOutButton: () =>
    PageElement.located(
      By.role('button', { name: 'خروج از سیستم', exact: true }),
    ).describedAs('log out button'),
};
