import { Identity } from '@framework/domain';

// `from`/`to` are optional at the type level and absent means "unfiltered"
// — the same convention `BomReportFilters` uses for its
// `registeredAtFrom`/`registeredAtTo` pair. The HTTP layer (the next
// dispatch) maps the wire-level `null` to `undefined` here, so a
// controller that doesn't send either key is an unbounded range, not
// "from epoch to 9999".
export class GetProductDailyBomsQuery {
  constructor(
    public readonly productId: Identity,
    public readonly from?: Date,
    public readonly to?: Date,
  ) {}
}
