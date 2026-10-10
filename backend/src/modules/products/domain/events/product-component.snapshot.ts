// A plain-data snapshot of one component line of a product's composition, as
// carried by `ProductRegistered`/`ProductDeleted` — so a subscriber (e.g.
// audit-logging) can show what was registered or removed without reaching
// into this module's value objects.
export interface ProductMaterialSnapshot {
  readonly name: string;
}

export interface ProductComponentSnapshot {
  readonly name: string;
  readonly materials: readonly ProductMaterialSnapshot[];
}
