import { actorCalled, actorInTheSpotlight } from '@serenity-js/core';

const nameInTheSpotlight = (): string | undefined => {
  try {
    return actorInTheSpotlight().name;
  } catch {
    return undefined;
  }
};

/**
 * Runs `work` as other actors without leaving any of them in the spotlight — a precondition or an
 * observation shouldn't change who a following bare `Then` speaks about (`actorCalled()` moves the
 * spotlight; see `acceptance-tests/CLAUDE.md`'s Gotchas). Used by the review vocabulary
 * (`bom-analyzing/daily-bom-approval.ts`, which re-exports it), `resampling-bom.ts` and the shared
 * «اکنون … باشد» clock step.
 */
export const keepingTheSpotlight = async (
  work: () => Promise<void>,
): Promise<void> => {
  const previous = nameInTheSpotlight();
  await work();
  if (previous) {
    actorCalled(previous);
  }
};
