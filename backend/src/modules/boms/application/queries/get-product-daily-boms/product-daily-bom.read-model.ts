// One line of one daily BOM's composition on the dashboard's per-product
// detail view: the cloned (component, material) pair from the daily BOM,
// alongside the actual weight recorded on that daily BOM and the
// corresponding weight on the referenced standard BOM at the moment the
// dashboard rendered. `standardWeight` is what makes the score computable
// at all (Σ |actualWeight - standardWeight| across the BOM's lines).
export class ProductDailyBomLine {
  constructor(
    public readonly componentName: string,
    public readonly materialName: string,
    public readonly actualWeight: number,
    public readonly standardWeight: number,
  ) {}
}

// The daily-BOM dashboard's per-product detail-row shape: one entry per
// daily BOM for the selected product in the queried range, with its
// `score` (the sum of |actualWeight - standardWeight| across every
// material line) and the per-line shape needed to render the breakdown
// table under the row.
//
// `registeredAt` is the wire string form the rest of the boms reporting
// surface uses, so the dashboard's response doesn't need any
// re-serialisation at the HTTP layer. `description` mirrors the
// `GetBomQuery` response — `null` from the database, `undefined` once it
// passes through the read model.
export class ProductDailyBom {
  constructor(
    public readonly id: string,
    public readonly orderNumber: string,
    public readonly registeredAt: string,
    public readonly description: string | undefined,
    public readonly score: number,
    public readonly lines: ProductDailyBomLine[],
  ) {}
}
