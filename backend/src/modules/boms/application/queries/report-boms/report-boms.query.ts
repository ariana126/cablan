import { BomReportFilters } from '@boms/application/service/bom-report.repository';

export class ReportBomsQuery {
  constructor(
    public readonly page: number,
    public readonly pageSize: number,
    public readonly filters: BomReportFilters,
  ) {}
}
