import {
  Answerable,
  Duration,
  Expectation,
  Interaction,
  Wait,
} from '@serenity-js/core';

/**
 * One polling interval for every wait in the suite.
 *
 * Serenity/JS 3.49's `Wait.until` checks its expectation every
 * `Wait.defaultPollingInterval` — 500 ms (minimum `Wait.minimumPollingInterval`,
 * 50 ms) — and `.pollingEvery(interval)` overrides it per interaction. Most of
 * the suite's waits are for something already on its way (a dialog closing, a
 * list rendering), so the default added up to half a second of dead time after
 * each one; profiling showed ~300 waits for a closing overlay costing ~750 ms
 * each. 100 ms keeps the polling cheap (an `isPresent` check is one browser
 * round trip) and still well above the 50 ms minimum.
 *
 * Waits for something to disappear do not use `not(isPresent())`: Serenity's
 * `isPresent` ends in a `waitFor` of 250 ms that no polling setting reaches,
 * so every check of an element already gone costs 250 ms. Use `isGone()`
 * (`./is-gone`), which counts the matching elements without waiting.
 */
export const POLLING_INTERVAL = Duration.ofMilliseconds(100);

/** The same interval in milliseconds, for hand-written polling loops. */
export const POLLING_INTERVAL_MS = 100;

/**
 * `Wait.until` at the suite's polling interval. Use this instead of
 * `Wait.until` everywhere; the timeout is Serenity's default (5 s).
 */
export const WaitUntil = <T>(
  actual: Answerable<T>,
  expectation: Expectation<T>,
): Interaction =>
  Wait.until(actual, expectation).pollingEvery(POLLING_INTERVAL);
