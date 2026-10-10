/**
 * The suite's own record of what the backend's test clock reads right now.
 *
 * The backend's clock is frozen and moved only by the suite — `support/hooks.ts` freezes it at
 * {@link scenarioStartInstant} before every scenario, and `screenplay/common/clock.ts`'s
 * `FreezeTimeAt`/`LetTimePass` move it from there — so the suite can always know what it reads
 * without asking. There is no endpoint to ask anyway: `testing/clock` is write-only.
 *
 * It exists for the browser. The frontend reads a JWT's `exp` and drops a session whose `exp` has
 * passed **by the browser's own clock**, while the backend stamps that `exp` from its frozen one. A
 * browser left on wall-clock time therefore sees every token the test backend issues as long
 * expired (`exp` = scenario start + 1h, months in the past) and throws the session away the moment
 * it is stored. `SyncBrowserClockWithTheSystem` reads this mirror to put the browser on the same
 * clock as the system it is talking to.
 *
 * Plain module state, like the rest of the suite's per-scenario state: `support/hooks.ts` resets it
 * alongside the backend clock before every scenario.
 */

/**
 * The instant every scenario starts from. Chosen by the suite rather than inherited from the
 * backend's own `clock/reset` default, so the mirror below never has to duplicate a backend
 * constant to stay true — it is the same instant that default happens to be, so nothing a scenario
 * asserts about dates moved when this was introduced.
 */
export const scenarioStartInstant = new Date('2026-01-01T00:00:00.000Z');

let current = new Date(scenarioStartInstant);

export const systemClock = {
  now: (): Date => new Date(current),
  freezeAt: (instant: Date): void => {
    current = new Date(instant);
  },
  advanceBy: (milliseconds: number): void => {
    current = new Date(current.getTime() + milliseconds);
  },
  reset: (): void => {
    current = new Date(scenarioStartInstant);
  },
};
