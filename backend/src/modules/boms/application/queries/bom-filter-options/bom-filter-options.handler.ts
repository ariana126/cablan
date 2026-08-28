import { BomReportRepository } from '@boms/application/service/bom-report.repository';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { BomFilterOptionsQuery } from './bom-filter-options.query';
import { BomFilterOptions } from './bom-filter-options.read-model';

@QueryHandler(BomFilterOptionsQuery)
export class BomFilterOptionsHandler implements IQueryHandler<BomFilterOptionsQuery> {
  constructor(private readonly bomReportRepository: BomReportRepository) {}

  async execute(): Promise<BomFilterOptions> {
    const options = await this.bomReportRepository.filterOptions();
    return new BomFilterOptions(
      options.brands,
      options.componentNames,
      options.standardBomMiCodes,
      options.productNames,
      options.registeredByUsers,
    );
  }
}
