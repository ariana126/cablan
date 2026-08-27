/**
 * Test-data types and registries for "ثبت آنالیز روزانه" (`registring-bom.feature`).
 *
 * A daily BOM's composition is a snapshot cloned from an existing STANDARD BOM's *current*
 * composition at registration time — the same clone-not-reference discipline
 * `standard-bom-details.ts`'s own comment already documents one level up (Product → StandardBom).
 * The standard BOM is looked up by its MI code, and — unlike every other cross-reference in this
 * clone chain — that MI code, not an id, is what actually travels in the HTTP request:
 * `RegisterBomDto`/`UpdateBomDto` (`backend/src/modules/boms/infrastructure/http/controllers/bom/
 * dto/`) take `standardBomMiCode`, because `boms` resolves it to an id server-side rather than
 * accepting one from the caller (see `backend/src/modules/boms/CLAUDE.md`'s "Why the cross-module
 * query is keyed by MI code, not by id"). `standardBomId` still exists on `NewBomDetails` below —
 * every registered daily BOM's read model reports it — but it is a *response*-only field; nothing
 * in this module ever sends it back to the API. Components/materials reference *existing* master
 * `components`/`materials` rows by id, cloned from the standard BOM, plus a required per-material
 * weight in grams that belongs only to the daily BOM.
 */

export interface NewMaterialInBomComponent {
  materialId: string;
  materialName: string;
  weightInGrams: number;
}

export interface NewComponentInBom {
  componentId: string;
  componentName: string;
  materials: NewMaterialInBomComponent[];
}

export interface NewBomDetails {
  /** Real, response-only: `GET /boms` reports it, but no request ever sends it back — see the
   * module doc comment above. Kept here mainly so `RegisteredBom` (below) has an id to remember. */
  standardBomId: string;
  /** The standard BOM's MI code — the actual identifying field `RegisterBomDto`/`UpdateBomDto`
   * expect on the wire (see the module doc comment above and `register-bom.ts#registerRequestBody`). */
  standardBomMiCode: string;
  orderNumber: string;
  trackingNumber: string;
  description?: string;
  components: NewComponentInBom[];
}

let sequence = 0;
const nextSequence = (): number => (sequence += 1);

export const freshOrderNumber = (): string =>
  `SO-${nextSequence()}-${Date.now()}`;

export const freshTrackingNumber = (): string =>
  `TRK-${nextSequence()}-${Date.now()}`;

/**
 * An arbitrary, valid, non-zero weight in grams — no scenario in this feature asserts a specific
 * value, so each material line gets its own freshly generated one rather than a literal repeated
 * everywhere. Mirrors `standard-bom-details.ts#freshWeightInGrams`.
 */
export const freshWeightInGrams = (): number =>
  Math.round((50 + Math.random() * 450) * 100) / 100;

/**
 * A fresh, valid set of details for a brand-new daily BOM, cloning the given standard BOM's
 * current composition (`components`, already carrying real master ids) and assigning each of its
 * materials a fresh weight.
 */
export const freshBomDetailsFor = (
  standardBom: { id: string; miCode: string },
  composition: NewComponentInBom[],
  overrides: Partial<
    Omit<NewBomDetails, 'standardBomId' | 'standardBomMiCode' | 'components'>
  > = {},
): NewBomDetails => ({
  standardBomId: standardBom.id,
  standardBomMiCode: standardBom.miCode,
  orderNumber: freshOrderNumber(),
  trackingNumber: freshTrackingNumber(),
  components: composition,
  ...overrides,
});

export interface RegisteredBom {
  id: string;
  standardBomId: string;
  standardBomMiCode: string;
  orderNumber: string;
  trackingNumber: string;
}

/**
 * Tracks daily BOMs this suite has registered over the course of a scenario — mirroring
 * `standard-bom-details.ts`'s equivalent registry, for the same reason: a *different* actor from
 * the one who registered one (the "بدون دسترسی" access-control rule's whole point) can still
 * address it by id, and a UI-driving task can address it by its (possibly still-current) order
 * number. Deliberately plain module state, not a Serenity `Notepad`: this is a fact about the
 * system, not one actor's own secret. Unlike `standard-bom-details.ts`'s registry, there is no
 * "registered by MI code" lookup here — every scenario in this feature only ever addresses "آن"
 * ("it"), the single daily BOM most recently registered, never a second one by some other key.
 */
let lastRegisteredBom: RegisteredBom | undefined;

export const rememberRegisteredBom = (bom: RegisteredBom): void => {
  lastRegisteredBom = bom;
};

export const theLastRegisteredBom = (): RegisteredBom => {
  if (!lastRegisteredBom) {
    throw new Error(
      'No daily BOM has been registered yet in this scenario — expected a preceding ' +
        '"اینکه یک آنالیز روزانه ... ثبت شده باشد" (or similar) step.',
    );
  }
  return lastRegisteredBom;
};

/**
 * The last thing an actor attempted to submit for this feature — a full `NewBomDetails` for a
 * registration attempt, or a `Partial<NewBomDetails>` for an edit — so the `Then` step that
 * follows can check the system against exactly what was tried. Mirrors
 * `standard-bom-details.ts`'s equivalent.
 */
let lastAttempt: unknown;

export const rememberAttempt = <T>(value: T): void => {
  lastAttempt = value;
};

export const theAttempt = <T>(): T => {
  if (lastAttempt === undefined) {
    throw new Error(
      'Nothing has been attempted yet in this scenario — expected a preceding ' +
        '"اطلاعات آنالیز ... جدید ... وارد میکند" (or similar) step.',
    );
  }
  return lastAttempt as T;
};
