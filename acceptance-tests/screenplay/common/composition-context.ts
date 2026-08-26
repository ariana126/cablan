/**
 * Disambiguates a step whose TEXT is byte-identical across more than one feature area, where the
 * feature files themselves — read-only input — leave no room to reword either side.
 *
 * `registring-product.feature`'s "قانون: یک جز می تواند بیش از یک مواد اولیه داشته باشد" and
 * `registring-standard-bom.feature`'s own rule of the same name share the exact wording for their
 * `When`/`Then` pair ("{actor} چند مواد اولیه برای آن جز ثبت می کند" / "تمام مواد اولیه ثبت شده به
 * جز مربوط باشند" — see `step-definitions/bom-registration/common.steps.ts`), even though what
 * "آن جز" ("that component") refers to is a component of a *product* in one feature and a component
 * of a *standard BOM* in the other, each with its own screenplay module, form, and master-data
 * shape (`edit-product.ts` vs `edit-standard-bom.ts`). Cucumber matches by text alone, so the single
 * shared step definition dispatches on whichever owner's own `Given` last set this.
 */
export type ComponentOwnerKind = 'product' | 'standard-bom';

let currentOwner: ComponentOwnerKind = 'product';

export const setCurrentComponentOwner = (owner: ComponentOwnerKind): void => {
  currentOwner = owner;
};

export const currentComponentOwner = (): ComponentOwnerKind => currentOwner;
