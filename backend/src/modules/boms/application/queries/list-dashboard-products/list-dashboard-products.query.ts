import { BomDashboardFilters } from '@boms/application/service/bom-dashboard.repository';

// Every filter is optional and absent means "unfiltered" — see
// `BomDashboardFilters` for the date range, the approval filters (which keep
// the report's absent-vs-`[]` distinction) and the order/tracking-number
// searches (blank = unfiltered). The controller leaves a key
// the request omitted `undefined` here, so an empty body is the whole history.
export class ListDashboardProductsQuery {
  constructor(public readonly filters: BomDashboardFilters) {}
}
