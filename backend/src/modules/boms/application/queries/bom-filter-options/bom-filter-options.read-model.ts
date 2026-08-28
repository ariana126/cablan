// Weight is deliberately absent — see "قانون: وزن مواد اولیه در بین فیلدهای
// قابل فیلتر نیست" in reporting-bom.feature.
export class BomFilterOptions {
  constructor(
    public readonly brands: string[],
    public readonly componentNames: string[],
    public readonly standardBomMiCodes: string[],
    public readonly productNames: string[],
    public readonly registeredByUsers: string[],
  ) {}
}
