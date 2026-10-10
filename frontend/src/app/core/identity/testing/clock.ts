import { vi } from 'vitest';

/**
 * Moves this browser's clock `seconds` forward (or back, if negative) from wherever it stands now.
 * Only `Date` is faked, so the router's and `HttpClient`'s own timers keep running. Pair it with
 * `vi.useRealTimers()` in an `afterEach`.
 */
export function moveClock(seconds: number): void {
  const target = Date.now() + seconds * 1000;
  if (!vi.isFakeTimers()) {
    vi.useFakeTimers({ toFake: ['Date'] });
  }
  vi.setSystemTime(target);
}
