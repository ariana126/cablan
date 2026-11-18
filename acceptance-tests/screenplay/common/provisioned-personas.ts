import { Interaction } from '@serenity-js/core';

/**
 * Which personas' accounts are known to exist **in the current scenario**.
 *
 * Scenario-scoped, never run-scoped: `support/hooks.ts` clears it right after the database truncate,
 * so it can never describe rows the truncate removed. It is also cleared by every step that deletes
 * a user or may rename one (`DeleteUser`, `EditUser`, the login test user's deletion), because those
 * make "this username exists with this password" untrue within a scenario.
 *
 * It memoises only the fact that an account exists, so `LogInAsPersona` can skip the admin login and
 * user lookup. It never holds a token or credentials: QC's stale-credentials bug showed that
 * carrying session state past its scenario logs in as a persona the truncate removed (401).
 */
const provisioned = new Set<string>();

export const isKnownToBeProvisioned = (username: string): boolean =>
  provisioned.has(username);

export const rememberProvisioned = (username: string): void => {
  provisioned.add(username);
};

export const forgetEveryProvisionedPersona = (): void => {
  provisioned.clear();
};

/** `forgetEveryProvisionedPersona`, for a task body. */
export const ForgetEveryProvisionedPersona = (): Interaction =>
  Interaction.where(
    '#actor forgets which persona accounts are known to exist',
    () => {
      forgetEveryProvisionedPersona();
      return Promise.resolve();
    },
  );
