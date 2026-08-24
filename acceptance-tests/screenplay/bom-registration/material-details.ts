export interface NewMaterialDetails {
  name: string;
}

let sequence = 0;
const nextSequence = (): number => (sequence += 1);

/**
 * A fresh, valid set of details for a brand-new raw material, distinct on every call so a
 * scenario that registers more than one "new material" never collides on name — this feature's
 * uniqueness rule makes that collision a real risk, unlike most other fields. Mirrors
 * `screenplay/authentication/user-details.ts`'s `freshUserDetails`.
 */
export const freshMaterialDetails = (
  overrides: Partial<NewMaterialDetails> = {},
): NewMaterialDetails => {
  const n = nextSequence();
  return {
    name: `ماده تست ${n}-${Date.now()}`,
    ...overrides,
  };
};

export interface RegisteredMaterial {
  id: string;
  name: string;
}

/**
 * Tracks materials this suite has registered over the course of a scenario, so a *different*
 * actor from the one who registered them (the "بدون دسترسی" access-control scenarios' whole
 * point) can still address them by id, and so a UI-driving task can address them by their
 * (possibly still-current) name. Deliberately plain module state, not a Serenity `Notepad`, for
 * the same reason `screenplay/authentication/user-details.ts`'s equivalent registry is: this is a
 * fact about the system, not one actor's own secret. Every scenario starts from a truncated
 * database (`support/hooks.ts`), so nothing here needs resetting between scenarios — it is simply
 * overwritten before it is next read.
 */
let lastRegisteredMaterial: RegisteredMaterial | undefined;
const registeredMaterialsByName = new Map<string, RegisteredMaterial>();

export const rememberRegisteredMaterial = (
  material: RegisteredMaterial,
): void => {
  lastRegisteredMaterial = material;
  registeredMaterialsByName.set(material.name, material);
};

export const theLastRegisteredMaterial = (): RegisteredMaterial => {
  if (!lastRegisteredMaterial) {
    throw new Error(
      'No material has been registered yet in this scenario — expected a preceding ' +
        '"اینکه یک مواد اولیه در سیستم ثبت شده باشد" (or similar) step.',
    );
  }
  return lastRegisteredMaterial;
};

export const theMaterialRegisteredWithName = (
  name: string,
): RegisteredMaterial => {
  const material = registeredMaterialsByName.get(name);
  if (!material) {
    throw new Error(
      `No material named "${name}" has been registered yet in this scenario.`,
    );
  }
  return material;
};

/**
 * The last thing an actor attempted to submit — a full `NewMaterialDetails` for a registration
 * attempt, or a `Partial<NewMaterialDetails>` for an edit — so the `Then` step that follows can
 * check the system against exactly what was tried, without a Cucumber step having to repeat the
 * data. Mirrors `screenplay/authentication/user-details.ts`'s equivalent.
 */
let lastAttempt: unknown;

export const rememberAttempt = <T>(value: T): void => {
  lastAttempt = value;
};

export const theAttempt = <T>(): T => {
  if (lastAttempt === undefined) {
    throw new Error(
      'Nothing has been attempted yet in this scenario — expected a preceding ' +
        '"اطلاعات مواد اولیه جدید را وارد می کند" (or similar) step.',
    );
  }
  return lastAttempt as T;
};
