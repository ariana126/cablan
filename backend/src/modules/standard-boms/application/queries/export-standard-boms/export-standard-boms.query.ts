import { StandardBomReportFilters } from '@standard-boms/application/service/standard-bom-report.repository';

export class ExportStandardBomsQuery {
  constructor(public readonly filters: StandardBomReportFilters) {}
}
