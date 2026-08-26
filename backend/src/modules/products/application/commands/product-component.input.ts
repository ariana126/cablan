// The raw, not-yet-validated shape a controller hands to `RegisterProductCommand`
// / `EditProductCommand` for each component (and, within it, each material) to
// register. Deliberately plain strings, not `ComponentName`/`MaterialName`
// value objects: those belong to the components/materials modules and are
// constructed only inside `ProductCompositionFactory`, the one place this
// module is allowed to reach for them (see
// src/modules/products/CLAUDE.md).
export interface RegisterProductMaterialInput {
  readonly name: string;
}

export interface RegisterProductComponentInput {
  readonly name: string;
  readonly materials: RegisterProductMaterialInput[];
}

// Edit-only shapes: a composition entry carrying an `id` refers to a
// component/material that is already part of *this* product's current
// composition and should be kept as-is, rather than registered as a new
// master row (see `ProductCompositionFactory.reconcileComponentLines`).
// `RegisterProduct*Input` above stay id-less on purpose: registration
// (`POST /products`) always creates every entry from scratch, so there is
// never an existing composition to reconcile against.
export interface EditProductMaterialInput extends RegisterProductMaterialInput {
  readonly id?: string;
}

export interface EditProductComponentInput extends RegisterProductComponentInput {
  readonly id?: string;
  readonly materials: EditProductMaterialInput[];
}
