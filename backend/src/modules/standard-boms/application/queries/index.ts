import { GetStandardBomByMiCodeHandler } from '@standard-boms/application/queries/get-standard-bom-by-mi-code/get-standard-bom-by-mi-code.handler';
import { ListStandardBomsHandler } from '@standard-boms/application/queries/list-standard-boms/list-standard-boms.handler';

export const QueryHandlers = [
  ListStandardBomsHandler,
  GetStandardBomByMiCodeHandler,
];
