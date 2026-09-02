import { By, PageElement } from '@serenity-js/web';

/** The greeting the landing page leads with, whoever is signed in. */
export const homePageGreeting = 'خوش آمدید';

/**
 * Lean Page Object for `/` (`frontend/src/app/features/home/home-page.ts`) — the page every
 * successful log-in lands on. Locates elements and reports what they say — nothing else; the
 * behaviour that uses them lives in `screenplay/authentication/logging-in.ts`.
 */
export const HomePage = {
  /**
   * The page's own `h1`, located by role and level rather than by its accessible name: the page
   * greets the signed-in user *by name* ("خوش آمدید، ..."), and `By.role`'s `name` cannot express
   * a prefix. Serenity builds Playwright's role-*selector* string rather than calling
   * `getByRole()`, and a quoted name there is always compared whole — `exact: false` only makes
   * that comparison case-insensitive, it does not make it a substring match. So the greeting is
   * asserted as text by the task that uses this, against `homePageGreeting` above.
   *
   * A page has one `h1`, so role + level is unambiguous. It is also what distinguishes this page
   * from the one a withheld route renders in its place, which keeps the URL but not the heading.
   */
  heading: () =>
    PageElement.located(By.role('heading', { level: 1 })).describedAs(
      'page heading',
    ),
};
