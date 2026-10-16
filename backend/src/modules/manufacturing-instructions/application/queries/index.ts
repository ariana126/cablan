import { ExportManufacturingInstructionsHandler } from '@manufacturing-instructions/application/queries/export-manufacturing-instructions/export-manufacturing-instructions.handler';
import { GetManufacturingInstructionByMiCodeHandler } from '@manufacturing-instructions/application/queries/get-manufacturing-instruction-by-mi-code/get-manufacturing-instruction-by-mi-code.handler';
import { GetManufacturingInstructionDetailHandler } from '@manufacturing-instructions/application/queries/get-manufacturing-instruction-detail/get-manufacturing-instruction-detail.handler';
import { ListManufacturingInstructionsHandler } from '@manufacturing-instructions/application/queries/list-manufacturing-instructions/list-manufacturing-instructions.handler';
import { ManufacturingInstructionFilterOptionsHandler } from '@manufacturing-instructions/application/queries/manufacturing-instruction-filter-options/manufacturing-instruction-filter-options.handler';
import { ReportManufacturingInstructionsHandler } from '@manufacturing-instructions/application/queries/report-manufacturing-instructions/report-manufacturing-instructions.handler';

export const QueryHandlers = [
  ListManufacturingInstructionsHandler,
  GetManufacturingInstructionByMiCodeHandler,
  GetManufacturingInstructionDetailHandler,
  ReportManufacturingInstructionsHandler,
  ManufacturingInstructionFilterOptionsHandler,
  ExportManufacturingInstructionsHandler,
];
