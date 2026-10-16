import { ManufacturingInstructionReportFilters } from '@manufacturing-instructions/application/service/manufacturing-instruction-report.repository';

export class ExportManufacturingInstructionsQuery {
  constructor(public readonly filters: ManufacturingInstructionReportFilters) {}
}
