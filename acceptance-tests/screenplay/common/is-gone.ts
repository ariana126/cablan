import {
  Answerable,
  Expectation,
  ExpectationDetails,
  ExpectationMet,
  ExpectationNotMet,
  ListItemNotFoundError,
} from '@serenity-js/core';
import type { PageElement } from '@serenity-js/web';
import type { Locator } from 'playwright';

/**
 * Met when nothing in the page matches the element any more.
 *
 * Use it in `WaitUntil(element, isGone())`, never `not(isPresent())`.
 * Serenity/JS 3.49's `isPresent()` asks Playwright to
 * `waitFor({ state: 'attached', timeout: 250 })`, so for an element that is
 * already gone every check runs to its 250 ms timeout — a floor under every
 * "gone" wait in the suite. `isGone()` instead asks the browser how many
 * elements match (`Locator.count()`, which never waits) and is met at zero.
 *
 * An element whose parent no longer exists is gone too: a parent chosen from a
 * list (`PageElements…where(…).first()`) that has left the list raises
 * `ListItemNotFoundError`, which is read as "gone". Any other error is
 * rethrown, so a broken locator never passes for a vanished element.
 *
 * Unlike every other `WaitUntil`, which reads an empty match as "not yet" and
 * keeps polling, an empty filtered list reads as gone here, and there is no
 * grace window (`isPresent` waited 250 ms). Use it only for something known to
 * have rendered, or after a cue showing the list or loading indicator is on
 * screen.
 */
export const isGone = (): Expectation<PageElement> => new IsGone();

class IsGone extends Expectation<PageElement> {
  constructor() {
    super('isGone', 'become gone', async (actor, actual) => {
      const gone = await IsGone.hasVanished(actual, (answerable) =>
        actor.answer(answerable),
      );
      return gone
        ? new ExpectationMet(
            'become gone',
            ExpectationDetails.of('isGone'),
            true,
            actual,
          )
        : new ExpectationNotMet(
            'become gone',
            ExpectationDetails.of('isGone'),
            true,
            actual,
          );
    });
  }

  private static async hasVanished(
    element: Answerable<PageElement>,
    answer: (answerable: Answerable<PageElement>) => Promise<PageElement>,
  ): Promise<boolean> {
    try {
      const locator = (await (
        await answer(element)
      ).nativeElement()) as Locator;
      return (await locator.count()) === 0;
    } catch (error) {
      if (error instanceof ListItemNotFoundError) {
        return true;
      }
      throw error;
    }
  }
}
