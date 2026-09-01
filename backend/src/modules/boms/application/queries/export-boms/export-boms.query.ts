import { BomReportFilters } from '@boms/application/service/bom-report.repository';

export class ExportBomsQuery {
  constructor(public readonly filters: BomReportFilters) {}
}
