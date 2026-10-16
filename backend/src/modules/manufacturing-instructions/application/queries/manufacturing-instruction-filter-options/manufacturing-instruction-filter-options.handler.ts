import { ManufacturingInstructionReportRepository } from '@manufacturing-instructions/application/service/manufacturing-instruction-report.repository';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { ManufacturingInstructionFilterOptionsQuery } from './manufacturing-instruction-filter-options.query';
import { ManufacturingInstructionFilterOptions } from './manufacturing-instruction-filter-options.read-model';

@QueryHandler(ManufacturingInstructionFilterOptionsQuery)
export class ManufacturingInstructionFilterOptionsHandler implements IQueryHandler<ManufacturingInstructionFilterOptionsQuery> {
  constructor(
    private readonly manufacturingInstructionReportRepository: ManufacturingInstructionReportRepository,
  ) {}

  async execute(): Promise<ManufacturingInstructionFilterOptions> {
    const options =
      await this.manufacturingInstructionReportRepository.filterOptions();
    return new ManufacturingInstructionFilterOptions(
      options.brands,
      options.activeStatuses,
      options.productNames,
      options.componentNames,
      options.miCodes,
    );
  }
}
