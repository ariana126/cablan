// One material line of a daily BOM measured against its standard BOM: the
// cloned (component, material) pair, the weight actually recorded on the daily
// BOM, the weight on the standard BOM's *current* composition (0 when the pair
// is no longer on it), and `difference`, the absolute deviation
// `|actualWeight - standardWeight|` — above and below the standard count
// alike. Shared by the dashboard's per-product rows and the post-registration
// preview, so both read the same numbers. See `StandardBomWeights`.
//
// `componentId`/`materialId` are the cloned ids — what an inline weight edit
// sends back through `PATCH /boms/:id` to rebuild the full composition.
export class MaterialWeightDifference {
  constructor(
    public readonly componentId: string,
    public readonly componentName: string,
    public readonly materialId: string,
    public readonly materialName: string,
    public readonly actualWeight: number,
    public readonly standardWeight: number,
    public readonly difference: number,
  ) {}
}
