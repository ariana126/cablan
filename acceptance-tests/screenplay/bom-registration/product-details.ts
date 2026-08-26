export interface NewMaterialInComponent {
  name: string;
}

export interface NewComponentInProduct {
  name: string;
  materials: NewMaterialInComponent[];
}

export interface NewProductDetails {
  name: string;
  components: NewComponentInProduct[];
}

let sequence = 0;
const nextSequence = (): number => (sequence += 1);

/**
 * A fresh, valid set of details for a brand-new raw material, nested inside a component — distinct
 * on every call the same way `screenplay/bom-registration/material-details.ts#freshMaterialDetails`
 * is, though this feature never tests material-name uniqueness the way the standalone materials
 * feature does.
 */
export const freshMaterialInComponent = (
  overrides: Partial<NewMaterialInComponent> = {},
): NewMaterialInComponent => {
  const n = nextSequence();
  return {
    name: `مواد اولیه تست ${n}-${Date.now()}`,
    ...overrides,
  };
};

/**
 * A fresh, valid set of details for a brand-new component, nested inside a product — one default
 * material, satisfying "قانون: هر جز حداقل یک مواد اولیه دارد" out of the box. Pass
 * `{ materials: [] }` to get a deliberately invalid, materials-less component for that rule's
 * negative scenarios.
 */
export const freshComponentInProduct = (
  overrides: Partial<NewComponentInProduct> = {},
): NewComponentInProduct => {
  const n = nextSequence();
  return {
    name: `جز تست ${n}-${Date.now()}`,
    materials: [freshMaterialInComponent()],
    ...overrides,
  };
};

/**
 * A fresh, valid set of details for a brand-new product — one default component (itself carrying
 * one default material), satisfying "قانون: هر محصول حداقل یک جز دارد" out of the box. Pass
 * `{ components: [] }` to get a deliberately invalid, component-less product for that rule's
 * negative scenarios.
 */
export const freshProductDetails = (
  overrides: Partial<NewProductDetails> = {},
): NewProductDetails => {
  const n = nextSequence();
  return {
    name: `محصول تست ${n}-${Date.now()}`,
    components: [freshComponentInProduct()],
    ...overrides,
  };
};

export interface RegisteredProduct {
  id: string;
  name: string;
}

/**
 * Tracks products this suite has registered over the course of a scenario, so a *different* actor
 * from the one who registered them (the "بدون دسترسی" access-control scenarios' whole point) can
 * still address them by id, and so a UI-driving task can address them by their (possibly
 * still-current) name. Deliberately plain module state, not a Serenity `Notepad`, mirroring
 * `screenplay/bom-registration/component-details.ts`'s equivalent registry for the same reason:
 * this is a fact about the system, not one actor's own secret. Every scenario starts from a
 * truncated database (`support/hooks.ts`), so nothing here needs resetting between scenarios — it
 * is simply overwritten before it is next read.
 */
let lastRegisteredProduct: RegisteredProduct | undefined;
const registeredProductsByName = new Map<string, RegisteredProduct>();

export const rememberRegisteredProduct = (product: RegisteredProduct): void => {
  lastRegisteredProduct = product;
  registeredProductsByName.set(product.name, product);
};

export const theLastRegisteredProduct = (): RegisteredProduct => {
  if (!lastRegisteredProduct) {
    throw new Error(
      'No product has been registered yet in this scenario — expected a preceding ' +
        '"اینکه یک محصول در سیستم ثبت شده باشد" (or similar) step.',
    );
  }
  return lastRegisteredProduct;
};

export const theProductRegisteredWithName = (
  name: string,
): RegisteredProduct => {
  const product = registeredProductsByName.get(name);
  if (!product) {
    throw new Error(
      `No product named "${name}" has been registered yet in this scenario.`,
    );
  }
  return product;
};

/**
 * The last thing an actor attempted to submit for this feature — a full `NewProductDetails` for a
 * registration attempt, a `Partial<NewProductDetails>` for a name edit, or a list of nested
 * components/materials for the "multiple" rules — so the `Then` step that follows can check the
 * system against exactly what was tried, without a Cucumber step having to repeat the data. Mirrors
 * `screenplay/bom-registration/component-details.ts`'s equivalent.
 */
let lastAttempt: unknown;

export const rememberAttempt = <T>(value: T): void => {
  lastAttempt = value;
};

export const theAttempt = <T>(): T => {
  if (lastAttempt === undefined) {
    throw new Error(
      'Nothing has been attempted yet in this scenario — expected a preceding ' +
        '"اطلاعات محصول جدید را وارد می کند" (or similar) step.',
    );
  }
  return lastAttempt as T;
};
