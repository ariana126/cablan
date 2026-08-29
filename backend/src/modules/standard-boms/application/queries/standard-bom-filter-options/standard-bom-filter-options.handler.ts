import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { StandardBomReportRepository } from '@standard-boms/application/service/standard-bom-report.repository';

import { StandardBomFilterOptionsQuery } from './standard-bom-filter-options.query';
import { StandardBomFilterOptions } from './standard-bom-filter-options.read-model';

@QueryHandler(StandardBomFilterOptionsQuery)
export class StandardBomFilterOptionsHandler implements IQueryHandler<StandardBomFilterOptionsQuery> {
  constructor(
    private readonly standardBomReportRepository: StandardBomReportRepository,
  ) {}

  async execute(): Promise<StandardBomFilterOptions> {
    const options = await this.standardBomReportRepository.filterOptions();
    return new StandardBomFilterOptions(
      options.brands,
      options.activeStatuses,
      options.productNames,
      options.componentNames,
    );
  }
}
