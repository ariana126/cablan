import { By, PageElement, PageElements } from '@serenity-js/web';

/** The greeting the landing page leads with, whoever is signed in. */
export const homePageGreeting = 'خوش آمدید';

/**
 * Lean Page Object for `/` (`frontend/src/app/features/home/home-page.ts`) — the page every
 * successful log-in lands on. Locates elements and reports what they say — nothing else; the
 * behaviour that uses them lives in `screenplay/authentication/logging-in.ts` and, for the role's
 * shortcuts, `screenplay/home/`.
 *
 * The shortcut locators follow the markup contract agreed with the frontend for issue #79
 * (`docs/superpowers/plans/2026-10-31-role-based-home-page.md`): ASSUMPTION until that page lands.
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

  /**
   * Every shortcut group on the page (issue #79): one `<section aria-labelledby>` — ARIA role
   * `region` — per non-empty top-level category, named by its `h2`. The page renders nothing else
   * as a region, so the role alone finds exactly the groups.
   */
  shortcutGroups: () =>
    PageElements.located(By.role('region')).describedAs('shortcut groups'),

  /** The `h2` naming a group — its text is exactly the category label. */
  shortcutGroupHeading: (group: PageElement) =>
    PageElement.located(By.role('heading', { level: 2 }))
      .of(group)
      .describedAs('shortcut group heading'),

  /** Every shortcut in a group: the group's links, and nothing else links from inside it. */
  shortcutsIn: (group: PageElement) =>
    PageElements.located(By.role('link')).of(group).describedAs('shortcuts'),

  /** A group found by its accessible name — the category label its `h2` carries. */
  shortcutGroupNamed: (group: string) =>
    PageElement.located(
      By.role('region', { name: group, exact: true }),
    ).describedAs(`shortcut group «${group}»`),

  /** A shortcut found by its accessible name inside the group it belongs to. */
  shortcutNamed: (group: string, shortcut: string) =>
    PageElement.located(By.role('link', { name: shortcut, exact: true }))
      .of(HomePage.shortcutGroupNamed(group))
      .describedAs(`shortcut «${shortcut}» in «${group}»`),
};
