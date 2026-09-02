// Mirrors `BomFilterOptions`. Weight is deliberately absent — see
// "قانون: وزن مواد اولیه در بین فیلدهای قابل فیلتر نیست" in
// reporting-standard-bom.feature.
export class StandardBomFilterOptions {
  constructor(
    public readonly brands: string[],
    public readonly activeStatuses: boolean[],
    public readonly productNames: string[],
    public readonly componentNames: string[],
    public readonly miCodes: string[],
  ) {}
}
