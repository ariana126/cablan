import { BomFilterOptionsHandler } from '@boms/application/queries/bom-filter-options/bom-filter-options.handler';
import { GetBomHandler } from '@boms/application/queries/get-bom/get-bom.handler';
import { ListBomsHandler } from '@boms/application/queries/list-boms/list-boms.handler';
import { ReportBomsHandler } from '@boms/application/queries/report-boms/report-boms.handler';

export const QueryHandlers = [
  ListBomsHandler,
  ReportBomsHandler,
  BomFilterOptionsHandler,
  GetBomHandler,
];
