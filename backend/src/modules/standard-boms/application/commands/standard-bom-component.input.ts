// The raw, not-yet-validated shape a controller hands to
// `RegisterStandardBomCommand`/`EditStandardBomCommand` for each component
// (and, within it, each material) to clone into the standard BOM's
// composition. Unlike `products`' equivalent input, these never create a new
// master row — `componentId`/`materialId` must already exist in the
// referenced product's current composition (see
// `StandardBomCompositionFactory`), so there is no id-optional "new vs
// reused" distinction the way `products`' edit input needs: registering and
// editing a standard BOM's composition validate and clone the same way.
export interface RegisterStandardBomMaterialInput {
  readonly materialId: string;
  readonly weight: number;
}

export interface RegisterStandardBomComponentInput {
  readonly componentId: string;
  readonly materials: RegisterStandardBomMaterialInput[];
}
