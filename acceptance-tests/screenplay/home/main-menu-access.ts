import { Check, d, notes, Task, Wait } from '@serenity-js/core';
import { Ensure, equals, isPresent, not } from '@serenity-js/assertions';
import { Attribute, Click, isVisible, Page } from '@serenity-js/web';
import { AuthNotes, LogIn } from '../common/login';
import { PersonaCredentialsNotes } from '../common/personas';
import { AppShell } from '../ui/app-shell';
import { BomDashboardPage } from '../ui/bom-dashboard-page';
import { ComponentsPage } from '../ui/components-page';
import { HomePage } from '../ui/home-page';

/**
 * Where a page sits in the main menu: the categories to open, outermost first. Only the pages a
 * scenario opens from the menu are listed — a missing one fails loudly rather than guessing.
 */
const MAIN_MENU_TRAILS: Record<string, readonly string[]> = {
  'داشبورد روزانه': ['کنترل کیفیت', 'گزارشات'],
  اجزا: ['اطلاعات پایه'],
};

const trailTo = (page: string): readonly string[] => {
  const trail = MAIN_MENU_TRAILS[page];
  if (!trail) {
    throw new Error(
      `No main menu trail is known for «${page}» — add it to MAIN_MENU_TRAILS in ` +
        'screenplay/home/main-menu-access.ts.',
    );
  }
  return trail;
};

/** Opens a category of the main menu unless it already is: a category holding the current page
 * opens itself, and clicking it again would close it. */
const ExpandMainMenuCategory = (label: string): Task =>
  Task.where(
    d`#actor expands the main menu category «${label}»`,
    Wait.until(AppShell.mainMenuCategory(label), isPresent()),
    Check.whether(
      Attribute.called('aria-expanded').of(AppShell.mainMenuCategory(label)),
      equals('false'),
    ).andIfSo(Click.on(AppShell.mainMenuCategory(label))),
  );

export const OpenFromTheMainMenu = {
  /**
   * «{actor} … را از منوی اصلی باز می کند» — logs in through `/login` (landing on home), opens the
   * drawer if the viewport keeps it shut, expands the page's categories and follows its link.
   */
  thePage: (page: string): Task =>
    Task.where(
      d`#actor opens «${page}» from the main menu`,
      LogIn.using(
        notes<AuthNotes>().get('username'),
        notes<PersonaCredentialsNotes>().get('password'),
      ),
      Wait.until(HomePage.heading(), isVisible()),
      Check.whether(AppShell.openMainMenuButton(), isVisible()).andIfSo(
        Click.on(AppShell.openMainMenuButton()),
      ),
      Wait.until(AppShell.mainMenu(), isVisible()),
      ...trailTo(page).map(ExpandMainMenuCategory),
      Wait.until(AppShell.mainMenuPage(page), isPresent()),
      Click.on(AppShell.mainMenuPage(page)),
    ),
};

/**
 * «داشبورد روزانه به او نشان داده شود» — the dashboard's own heading at its own address. A page the
 * role may not reach keeps the URL but renders the not-found page instead, so the heading is what
 * tells the two apart.
 */
export const EnsureDailyBomDashboardShown = (): Task =>
  Task.where(
    '#actor ensures the daily BOM dashboard is shown',
    Wait.until(Page.current().url().pathname, equals('/boms/dashboard')),
    Wait.until(BomDashboardPage.heading(), isVisible()),
  );

/**
 * «فهرست اجزا به او نشان داده شود» — the components page with its list loaded: the list's result
 * count appears only once the system has answered with the components, and no refusal or error
 * banner stands in for them.
 */
export const EnsureComponentListShown = (): Task =>
  Task.where(
    '#actor ensures the component list is shown',
    Wait.until(Page.current().url().pathname, equals('/components')),
    Wait.until(ComponentsPage.heading(), isVisible()),
    Wait.until(ComponentsPage.list(), isVisible()),
    Wait.until(ComponentsPage.listCount(), isPresent()),
    Ensure.that(ComponentsPage.listAlert(), not(isPresent())),
  );
