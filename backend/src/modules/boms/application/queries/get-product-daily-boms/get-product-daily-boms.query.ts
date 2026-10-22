import { BomDashboardFilters } from '@boms/application/service/bom-dashboard.repository';
import { Identity } from '@framework/domain';

// Every filter is optional and absent means "unfiltered" — see
// `BomDashboardFilters` for the date range and the approval filters, which
// keep the report's absent-vs-`[]` distinction. The controller leaves a key
// the request omitted `undefined` here, so an empty body is the whole history.
export class GetProductDailyBomsQuery {
  constructor(
    public readonly productId: Identity,
    public readonly filters: BomDashboardFilters,
  ) {}
}
