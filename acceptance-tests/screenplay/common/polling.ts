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
 * Serenity/JS 3.44's `Wait.until` checks its expectation every
 * `Wait.defaultPollingInterval` — 500 ms (minimum `Wait.minimumPollingInterval`,
 * 50 ms) — and `.pollingEvery(interval)` overrides it per interaction. Most of
 * the suite's waits are for something already on its way (a dialog closing, a
 * list rendering), so the default added up to half a second of dead time after
 * each one; profiling showed ~300 waits for a closing overlay costing ~750 ms
 * each. 100 ms keeps the polling cheap (an `isPresent` check is one browser
 * round trip) and still well above the 50 ms minimum.
 *
 * What remains of a `not(isPresent())` wait is not this interval: it is
 * Serenity's own `isPresent` `waitFor` (250 ms), which no polling setting
 * reaches.
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
