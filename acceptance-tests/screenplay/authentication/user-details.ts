import { SystemRole } from '../common/roles';

export interface NewUserDetails {
  name: string;
  username: string;
  password: string;
  role: SystemRole;
}

let sequence = 0;
const nextSequence = (): number => (sequence += 1);

/**
 * A fresh, valid set of details for a brand-new user, distinct on every call so a scenario that
 * registers more than one "new user" never collides on username. These values aren't meant to be
 * read by a person — they exist to satisfy validation, not to model a real employee — which is
 * why they're generated rather than hardcoded, unlike the four named personas in
 * `screenplay/common/personas.ts`. `role` defaults to گزارشگیر (Reporter), the least-privileged
 * one, since most scenarios that need "a user" don't care which role it holds.
 */
export const freshUserDetails = (
  overrides: Partial<NewUserDetails> = {},
): NewUserDetails => {
  const n = nextSequence();
  return {
    name: `کاربر تست ${n}`,
    username: `test-user-${n}-${Date.now()}`,
    password: `Test-P@ss-${n}!`,
    role: 'گزارشگیر',
    ...overrides,
  };
};

export interface RegisteredUser {
  id: string;
  username: string;
}

/**
 * Tracks users this suite has registered over the course of a scenario, so a *different* actor
 * from the one who registered them (the "بدون دسترسی" access-control scenarios' whole point) can
 * still address them by id.
 *
 * This is deliberately plain module state, not a Serenity `Notepad` — notepads are scoped to a
 * single actor by design (`support/actors.ts`: "nothing one actor did can leak into another
 * actor's scenario"), which is exactly right for an actor's own secrets but wrong for a fact
 * about the system itself (a user's id), which several actors legitimately need to know the same
 * way several people can know a URL. Every scenario re-registers whatever "that user" it needs as
 * its own first step (the database is truncated between scenarios — `support/hooks.ts`), so
 * nothing here needs resetting between scenarios; it's simply overwritten before it's next read.
 */
let lastRegisteredUser: RegisteredUser | undefined;
const registeredUsersByUsername = new Map<string, RegisteredUser>();

export const rememberRegisteredUser = (user: RegisteredUser): void => {
  lastRegisteredUser = user;
  registeredUsersByUsername.set(user.username, user);
};

export const theLastRegisteredUser = (): RegisteredUser => {
  if (!lastRegisteredUser) {
    throw new Error(
      'No user has been registered yet in this scenario — expected a preceding ' +
        '"اینکه یک کاربر در سیستم ثبت شده باشد" (or similar) step.',
    );
  }
  return lastRegisteredUser;
};

export const theUserRegisteredWithUsername = (
  username: string,
): RegisteredUser => {
  const user = registeredUsersByUsername.get(username);
  if (!user) {
    throw new Error(
      `No user with username "${username}" has been registered yet in this scenario.`,
    );
  }
  return user;
};

/**
 * The last thing an actor attempted to submit — a full `NewUserDetails` for a registration
 * attempt, or a `Partial<NewUserDetails>` for an edit — so the `Then` step that follows can check
 * the system against exactly what was tried, without a Cucumber step having to repeat the data.
 * Plain module state for the same reason as the registry above: the actor asserting isn't always
 * the same actor's notepad that would otherwise hold it, and unlike the registry there's exactly
 * one "current attempt" at a time within a scenario, so a single slot is enough.
 */
let lastAttempt: unknown;

export const rememberAttempt = <T>(value: T): void => {
  lastAttempt = value;
};

export const theAttempt = <T>(): T => {
  if (lastAttempt === undefined) {
    throw new Error(
      'Nothing has been attempted yet in this scenario — expected a preceding ' +
        '"اطلاعات کاربر جدید را وارد می کند" (or similar) step.',
    );
  }
  return lastAttempt as T;
};
