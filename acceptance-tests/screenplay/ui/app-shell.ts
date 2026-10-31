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

  /** The toolbar's brand link back to the home page — an in-app (router) link, so following it
   * leaves the current page without reloading the app. Accessible name «کابلان، صفحهٔ اصلی». */
  homeLink: () =>
    PageElement.located(
      By.role('link', { name: 'کابلان، صفحهٔ اصلی', exact: true }),
    ).describedAs('home link'),

  /**
   * The toolbar's menu button while the drawer is shut — its accessible name flips to «بستن منو»
   * once open, so it is found only when there is something to open. A wide viewport pins the
   * drawer open and this button then says «بستن منو».
   */
  openMainMenuButton: () =>
    PageElement.located(
      By.role('button', { name: 'گشودن منو', exact: true }),
    ).describedAs('open main menu button'),

  /** The drawer's navigation landmark — the main menu every locator below is scoped to, so a
   * home-page shortcut carrying the same label as a menu entry is never picked up instead. */
  mainMenu: () =>
    PageElement.located(
      By.role('navigation', { name: 'بخش های سامانه', exact: true }),
    ).describedAs('main menu'),

  /**
   * A category in the main menu: a disclosure button named by its label, carrying `aria-expanded`.
   * A collapsed category's children are `hidden`, so a nested category is reachable only once its
   * parent is open.
   */
  mainMenuCategory: (label: string) =>
    PageElement.located(By.role('button', { name: label, exact: true }))
      .of(AppShell.mainMenu())
      .describedAs(`main menu category «${label}»`),

  /** A page in the main menu — a link named by the page's label. */
  mainMenuPage: (label: string) =>
    PageElement.located(By.role('link', { name: label, exact: true }))
      .of(AppShell.mainMenu())
      .describedAs(`main menu entry «${label}»`),

  logOutMenuItem: () =>
    PageElement.located(
      By.role('menuitem', { name: 'خروج از سیستم', exact: true }),
    ).describedAs('log out menu item'),
};
