import { Answerable, Interaction, Question, Task } from '@serenity-js/core';
import { PlaywrightPage } from '@serenity-js/playwright';
import { PostRequest, Send } from '@serenity-js/rest';
import { systemClock } from '../../support/system-clock';

const toDate = (value: Date | string): Date =>
  value instanceof Date ? value : new Date(value);

/**
 * Freeze the backend clock at a given instant. Everything time-derived from then
 * on — JWT `iat`, token expiry, `registeredAt` — is stamped from this value until
 * it is changed again.
 */
export const FreezeTimeAt = (instant: Answerable<Date | string>): Task =>
  Task.where(
    '#actor freezes time',
    Send.a(
      PostRequest.to('testing/clock').with(
        Question.about('the instant to freeze time at', async (actor) => {
          const value = await actor.answer(instant);
          return { now: value instanceof Date ? value.toISOString() : value };
        }),
      ),
    ),
    Interaction.where('#actor notes the new time', async (actor) =>
      systemClock.freezeAt(toDate(await actor.answer(instant))),
    ),
  );

/**
 * Advance the backend clock forward by a number of milliseconds from its current
 * frozen instant — e.g. to move past a token's expiry without freezing at a
 * magic timestamp.
 */
export const LetTimePass = (milliseconds: Answerable<number>): Task =>
  Task.where(
    '#actor lets time pass',
    Send.a(
      PostRequest.to('testing/clock/advance').with(
        Question.about('the amount of time to advance', async (actor) => ({
          milliseconds: await actor.answer(milliseconds),
        })),
      ),
    ),
    Interaction.where('#actor notes the new time', async (actor) =>
      systemClock.advanceBy(await actor.answer(milliseconds)),
    ),
  );

/**
 * Puts the actor's browser on the system's clock — the instant the backend's test clock reads
 * (`support/system-clock.ts`), from which the browser's own time then flows on normally.
 *
 * The frontend judges a session's `exp` by the browser's clock while the backend stamps it from its
 * frozen one, so a browser left on wall-clock time throws away every session the test backend
 * issues. Run before a browser session starts (`screenplay/common/login.ts#LogIn.using`). Only the
 * browser's `Date` is moved; it reaches the raw Playwright context because Serenity/JS offers no
 * clock interaction of its own — the same narrowly-scoped exception `downloads.ts` makes.
 */
export const SyncBrowserClockWithTheSystem = (): Interaction =>
  Interaction.where(
    "#actor sets the browser's clock to the system's time",
    async (actor) => {
      const page = await actor.answer(PlaywrightPage.current());
      const nativePage = await page.nativePage();
      await nativePage.context().clock.setSystemTime(systemClock.now());
    },
  );
