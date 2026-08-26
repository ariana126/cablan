/**
 * Test-data types and registries for "ثبت آنالیز استاندارد" (`registring-standard-bom.feature`).
 *
 * A Standard BOM's composition is a snapshot cloned from an existing product at registration
 * time (see the feature's own domain note — later changes to the product never retroactively
 * change an already-registered Standard BOM), so unlike `product-details.ts`'s components/materials
 * (freeform names, created new on every registration), a Standard BOM's components/materials
 * reference *existing* master `components`/`materials` rows by id — the same master data
 * `component-details.ts`/`material-details.ts` already track — plus a required per-material weight
 * in grams that exists only here.
 */

export interface NewMaterialInStandardBomComponent {
  materialId: string;
  materialName: string;
  weightInGrams: number;
}

export interface NewComponentInStandardBom {
  componentId: string;
  componentName: string;
  materials: NewMaterialInStandardBomComponent[];
}

export interface NewStandardBomDetails {
  productId: string;
  productName: string;
  miCode: string;
  brand: string;
  /** Kept as the string a visitor would type into the field; cast to a number when building the
   * API request body. */
  standardLength: string;
  /** `undefined` means "not specified" — this feature's own "وضعیت فعال بودن ... باید ... مشخص
   * شود" rule requires the field be given explicitly, with no default. */
  active: boolean | undefined;
  description?: string;
  components: NewComponentInStandardBom[];
}

let sequence = 0;
const nextSequence = (): number => (sequence += 1);

export const freshMiCode = (): string => `MI-${nextSequence()}-${Date.now()}`;

export const freshBrand = (): string =>
  `برند تست ${nextSequence()}-${Date.now()}`;

export const freshStandardLength = (): string => `${100 + nextSequence()}`;

/**
 * An arbitrary, valid, non-zero weight in grams — no scenario in this feature asserts a specific
 * value, so each material line gets its own freshly generated one rather than a literal repeated
 * everywhere (per the dispatch's own instruction).
 */
export const freshWeightInGrams = (): number =>
  Math.round((50 + Math.random() * 450) * 100) / 100;

/**
 * A fresh, valid set of details for a brand-new standard BOM, cloning the given product's current
 * composition (`components`, already carrying real master ids) and assigning each of its materials
 * a fresh weight. `active` defaults to `true`; pass `{ active: undefined }` to get the deliberately
 * invalid, unspecified-active shape "قانون: وضعیت فعال بودن ... مشخص شود"'s negative example needs.
 */
export const freshStandardBomDetailsFor = (
  product: { id: string; name: string },
  composition: NewComponentInStandardBom[],
  overrides: Partial<
    Omit<NewStandardBomDetails, 'productId' | 'productName' | 'components'>
  > = {},
): NewStandardBomDetails => ({
  productId: product.id,
  productName: product.name,
  miCode: freshMiCode(),
  brand: freshBrand(),
  standardLength: freshStandardLength(),
  active: true,
  components: composition,
  ...overrides,
});

export interface RegisteredStandardBom {
  id: string;
  miCode: string;
  productId: string;
  productName: string;
}

/**
 * Tracks standard BOMs this suite has registered over the course of a scenario — mirroring
 * `screenplay/bom-registration/product-details.ts`'s equivalent registry, for the same reason: a
 * *different* actor from the one who registered one (the "بدون دسترسی" access-control scenarios'
 * whole point) can still address it by id, and a UI-driving task can address it by its (possibly
 * still-current) MI code. Deliberately plain module state, not a Serenity `Notepad`: this is a fact
 * about the system, not one actor's own secret. Every scenario starts from a truncated database
 * (`support/hooks.ts`), so nothing here needs resetting between scenarios.
 */
let lastRegisteredStandardBom: RegisteredStandardBom | undefined;
const registeredStandardBomsByMiCode = new Map<string, RegisteredStandardBom>();

export const rememberRegisteredStandardBom = (
  standardBom: RegisteredStandardBom,
): void => {
  lastRegisteredStandardBom = standardBom;
  registeredStandardBomsByMiCode.set(standardBom.miCode, standardBom);
};

export const theLastRegisteredStandardBom = (): RegisteredStandardBom => {
  if (!lastRegisteredStandardBom) {
    throw new Error(
      'No standard BOM has been registered yet in this scenario — expected a preceding ' +
        '"اینکه یک آنالیز استاندارد ... ثبت شده باشد" (or similar) step.',
    );
  }
  return lastRegisteredStandardBom;
};

export const theStandardBomRegisteredWithMiCode = (
  miCode: string,
): RegisteredStandardBom => {
  const standardBom = registeredStandardBomsByMiCode.get(miCode);
  if (!standardBom) {
    throw new Error(
      `No standard BOM with MI code "${miCode}" has been registered yet in this scenario.`,
    );
  }
  return standardBom;
};

/**
 * The last thing an actor attempted to submit for this feature — a full `NewStandardBomDetails`
 * for a registration attempt, or a `Partial<NewStandardBomDetails>` for an edit — so the `Then`
 * step that follows can check the system against exactly what was tried. Mirrors
 * `screenplay/bom-registration/product-details.ts`'s equivalent.
 */
let lastAttempt: unknown;

export const rememberAttempt = <T>(value: T): void => {
  lastAttempt = value;
};

export const theAttempt = <T>(): T => {
  if (lastAttempt === undefined) {
    throw new Error(
      'Nothing has been attempted yet in this scenario — expected a preceding ' +
        '"اطلاعات آنالیز استاندارد جدید ... وارد میکند" (or similar) step.',
    );
  }
  return lastAttempt as T;
};
