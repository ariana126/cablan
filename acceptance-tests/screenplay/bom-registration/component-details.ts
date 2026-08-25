export interface NewComponentDetails {
  name: string;
}

let sequence = 0;
const nextSequence = (): number => (sequence += 1);

/**
 * A fresh, valid set of details for a brand-new component, distinct on every call so a scenario
 * that registers more than one "new component" never collides on name — this feature's uniqueness
 * rule makes that collision a real risk, unlike most other fields. Mirrors
 * `screenplay/bom-registration/material-details.ts`'s `freshMaterialDetails`.
 *
 * There is deliberately no relation to Material or Product here or anywhere else in this module:
 * an orphan component — one belonging to no BOM — is a valid, standalone record.
 */
export const freshComponentDetails = (
  overrides: Partial<NewComponentDetails> = {},
): NewComponentDetails => {
  const n = nextSequence();
  return {
    name: `جز تست ${n}-${Date.now()}`,
    ...overrides,
  };
};

export interface RegisteredComponent {
  id: string;
  name: string;
}

/**
 * Tracks components this suite has registered over the course of a scenario, so a *different*
 * actor from the one who registered them (the "بدون دسترسی" access-control scenarios' whole
 * point) can still address them by id, and so a UI-driving task can address them by their
 * (possibly still-current) name. Deliberately plain module state, not a Serenity `Notepad`, for the
 * same reason `screenplay/bom-registration/material-details.ts`'s equivalent registry is: this is a
 * fact about the system, not one actor's own secret. Every scenario starts from a truncated
 * database (`support/hooks.ts`), so nothing here needs resetting between scenarios — it is simply
 * overwritten before it is next read.
 */
let lastRegisteredComponent: RegisteredComponent | undefined;
const registeredComponentsByName = new Map<string, RegisteredComponent>();

export const rememberRegisteredComponent = (
  component: RegisteredComponent,
): void => {
  lastRegisteredComponent = component;
  registeredComponentsByName.set(component.name, component);
};

export const theLastRegisteredComponent = (): RegisteredComponent => {
  if (!lastRegisteredComponent) {
    throw new Error(
      'No component has been registered yet in this scenario — expected a preceding ' +
        '"اینکه یک جز در سیستم ثبت شده باشد" (or similar) step.',
    );
  }
  return lastRegisteredComponent;
};

export const theComponentRegisteredWithName = (
  name: string,
): RegisteredComponent => {
  const component = registeredComponentsByName.get(name);
  if (!component) {
    throw new Error(
      `No component named "${name}" has been registered yet in this scenario.`,
    );
  }
  return component;
};

/**
 * The last thing an actor attempted to submit — a full `NewComponentDetails` for a registration
 * attempt, or a `Partial<NewComponentDetails>` for an edit — so the `Then` step that follows can
 * check the system against exactly what was tried, without a Cucumber step having to repeat the
 * data. Mirrors `screenplay/bom-registration/material-details.ts`'s equivalent.
 */
let lastAttempt: unknown;

export const rememberAttempt = <T>(value: T): void => {
  lastAttempt = value;
};

export const theAttempt = <T>(): T => {
  if (lastAttempt === undefined) {
    throw new Error(
      'Nothing has been attempted yet in this scenario — expected a preceding ' +
        '"اطلاعات جز جدید را وارد می کند" (or similar) step.',
    );
  }
  return lastAttempt as T;
};
