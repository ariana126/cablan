import {
  d,
  notes,
  Question,
  QuestionAdapter,
  Task,
  Wait,
} from '@serenity-js/core';
import {
  Ensure,
  equals,
  isGreaterThan,
  isPresent,
  startsWith,
} from '@serenity-js/assertions';
import { isVisible, Page, Text } from '@serenity-js/web';
import { AuthNotes, LogIn } from '../common/login';
import { PersonaCredentialsNotes } from '../common/personas';
import { HomePage, homePageGreeting } from '../ui/home-page';

/** One row of «میانبرهای صفحه اصلی او دقیقاً به صورت زیر باشد»: a shortcut and the group
 * (top-level menu category) it is shown under. */
export interface HomePageShortcut {
  group: string;
  shortcut: string;
}

/** A group the page renders with no shortcut in it — reported as a pair of its own, so an empty
 * group fails the exact comparison just as an extra shortcut does. */
const NO_SHORTCUT = '(بدون میانبر)';

const asPair = ({ group, shortcut }: HomePageShortcut): string =>
  `${group} ← ${shortcut}`;

/**
 * «{actor} صفحه اصلی را مشاهده می کند» — logs in through `/login` with the credentials the actor's
 * own notepad holds (left there by «… وارد سیستم شده باشد», or by the role-change precondition),
 * which lands on `/`, then waits for the role's shortcut groups to render: the shell loads the
 * current user, and with it the role, after the page itself has rendered.
 */
export const ViewHomePage = (): Task =>
  Task.where(
    '#actor views the home page',
    LogIn.using(
      notes<AuthNotes>().get('username'),
      notes<PersonaCredentialsNotes>().get('password'),
    ),
    Wait.until(Page.current().url().pathname, equals('/')),
    Wait.until(HomePage.heading(), isVisible()),
    Ensure.that(Text.of(HomePage.heading()), startsWith(homePageGreeting)),
    Wait.until(HomePage.shortcutGroups().count(), isGreaterThan(0)),
  );

/**
 * Every (group, shortcut) pair the home page shows, read as the visitor reads it — each group's
 * `h2`, and the text of each link inside it — sorted, since the Gherkin compares a set: the order
 * on screen is the menu's, which the scenarios do not state.
 */
const TheHomePageShortcuts = (): QuestionAdapter<string[]> =>
  Question.about('the shortcuts on the home page', async (actor) => {
    const groups = await actor.answer(HomePage.shortcutGroups());
    const pairs: string[] = [];
    for (const group of groups) {
      const groupName = (
        await actor.answer(Text.of(HomePage.shortcutGroupHeading(group)))
      ).trim();
      const shortcuts = await actor.answer(
        Text.ofAll(HomePage.shortcutsIn(group)),
      );
      if (shortcuts.length === 0) {
        pairs.push(asPair({ group: groupName, shortcut: NO_SHORTCUT }));
      }
      for (const shortcut of shortcuts) {
        pairs.push(asPair({ group: groupName, shortcut: shortcut.trim() }));
      }
    }
    return pairs.sort();
  });

/**
 * «میانبرهای صفحه اصلی او دقیقاً به صورت زیر باشد» — exactly these pairs: no shortcut missing, none
 * extra, no group left empty. Compared on what the page shows; then each expected shortcut is also
 * found by its accessible name inside the region its group names, which is the markup contract a
 * screen-reader user (and this suite's other steps) relies on.
 */
export const EnsureHomePageShortcutsAre = (
  expected: HomePageShortcut[],
): Task =>
  Task.where(
    d`#actor ensures the home page's shortcuts are exactly ${expected.map(asPair).join('، ')}`,
    Ensure.that(TheHomePageShortcuts(), equals(expected.map(asPair).sort())),
    ...expected.map(({ group, shortcut }) =>
      Ensure.that(HomePage.shortcutNamed(group, shortcut), isPresent()),
    ),
  );
