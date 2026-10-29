import { Answerable, Interaction, Question, Task } from '@serenity-js/core';
import { PlaywrightPage } from '@serenity-js/playwright';
import { PostRequest, Send } from '@serenity-js/rest';
import { systemClock } from '../../support/system-clock';
import { tehranWallClockInstant } from './jalali-datetime';

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
 * «اکنون «1403/06/15» ساعت «10:00» باشد» — freezes the system's clock at that Jalali date and
 * Asia/Tehran wall-clock time (`jalali-datetime.ts#tehranWallClockInstant`), recorded in the suite's
 * mirror like every `FreezeTimeAt`.
 *
 * A browser already open is **not** moved, deliberately: no scenario has one open when it states
 * the time, and every UI task begins with `LogIn.using`, which puts the browser on the system's
 * clock first (`SyncBrowserClockWithTheSystem`). A scenario that states the time in the middle of a
 * browser session would have to sync that browser again.
 */
export const LetItBeNow = (date: string, time: string): Task =>
  Task.where(
    `#actor lets it be ${date} ${time} in Tehran`,
    FreezeTimeAt(tehranWallClockInstant(date, time)),
  );

/**
 * The wall-clock time a bare date («امروز «1405/07/15» باشد») is frozen at. Mid-morning, so neither
 * the Tehran/UTC offset nor a few seconds of scenario time can tip the instant into another day.
 */
const TIME_OF_DAY_FOR_A_BARE_DATE = '10:00';

/**
 * «امروز «1405/07/15» باشد» — "today" is the Asia/Tehran calendar date of the system's clock
 * (`docs/superpowers/specs/2026-10-29-maintenance-management-design.md`), so this freezes it at
 * that Jalali date, at `TIME_OF_DAY_FOR_A_BARE_DATE` in Tehran.
 *
 * Moving the clock forward expires every session issued before it (the backend checks a JWT's
 * `exp` against the same frozen clock), so the caller renews whichever sessions it still needs —
 * `screenplay/common/personas.ts#RenewApiSession`.
 */
export const LetItBeToday = (date: string): Task =>
  Task.where(
    `#actor lets it be ${date} in Tehran`,
    FreezeTimeAt(tehranWallClockInstant(date, TIME_OF_DAY_FOR_A_BARE_DATE)),
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
