import { BomFilterOptionsHandler } from '@boms/application/queries/bom-filter-options/bom-filter-options.handler';
import { ExportBomsHandler } from '@boms/application/queries/export-boms/export-boms.handler';
import { GetBomHandler } from '@boms/application/queries/get-bom/get-bom.handler';
import { GetProductDailyBomsHandler } from '@boms/application/queries/get-product-daily-boms/get-product-daily-boms.handler';
import { ListBomsHandler } from '@boms/application/queries/list-boms/list-boms.handler';
import { ListDashboardProductsHandler } from '@boms/application/queries/list-dashboard-products/list-dashboard-products.handler';
import { ReportBomsHandler } from '@boms/application/queries/report-boms/report-boms.handler';

export const QueryHandlers = [
  ListBomsHandler,
  ReportBomsHandler,
  BomFilterOptionsHandler,
  GetBomHandler,
  ListDashboardProductsHandler,
  GetProductDailyBomsHandler,
  ExportBomsHandler,
];
