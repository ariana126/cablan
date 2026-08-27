// The raw, not-yet-validated shape a controller hands to
// `RegisterBomCommand`/`EditBomCommand` for each component (and, within it,
// each material) to clone into the BOM's composition. Mirrors
// `standard-boms`' own `RegisterStandardBomComponentInput`: these never
// create a new master row — `componentId`/`materialId` must already exist in
// the referenced standard BOM's current composition (see
// `BomCompositionFactory`), so there is no id-optional "new vs reused"
// distinction, and registering and editing a BOM's composition validate and
// clone the same way.
export interface BomMaterialInput {
  readonly materialId: string;
  readonly weight: number;
}

export interface BomComponentInput {
  readonly componentId: string;
  readonly materials: BomMaterialInput[];
}
