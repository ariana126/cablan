import { ExportStandardBomsHandler } from '@standard-boms/application/queries/export-standard-boms/export-standard-boms.handler';
import { GetStandardBomByMiCodeHandler } from '@standard-boms/application/queries/get-standard-bom-by-mi-code/get-standard-bom-by-mi-code.handler';
import { GetStandardBomDetailHandler } from '@standard-boms/application/queries/get-standard-bom-detail/get-standard-bom-detail.handler';
import { ListStandardBomsHandler } from '@standard-boms/application/queries/list-standard-boms/list-standard-boms.handler';
import { ReportStandardBomsHandler } from '@standard-boms/application/queries/report-standard-boms/report-standard-boms.handler';
import { StandardBomFilterOptionsHandler } from '@standard-boms/application/queries/standard-bom-filter-options/standard-bom-filter-options.handler';

export const QueryHandlers = [
  ListStandardBomsHandler,
  GetStandardBomByMiCodeHandler,
  GetStandardBomDetailHandler,
  ReportStandardBomsHandler,
  StandardBomFilterOptionsHandler,
  ExportStandardBomsHandler,
];
