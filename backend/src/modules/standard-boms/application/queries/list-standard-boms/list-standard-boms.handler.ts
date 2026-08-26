import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { StandardBomRepository } from '@standard-boms/domain/service/standard-bom.repository';

import { ListStandardBomsQuery } from './list-standard-boms.query';
import { StandardBomReadModel } from './standard-bom.read-model';

@QueryHandler(ListStandardBomsQuery)
export class ListStandardBomsHandler implements IQueryHandler<ListStandardBomsQuery> {
  constructor(private readonly standardBomRepository: StandardBomRepository) {}

  async execute(): Promise<StandardBomReadModel[]> {
    const standardBoms = await this.standardBomRepository.list();
    return standardBoms.map((standardBom) =>
      StandardBomReadModel.fromDomain(standardBom),
    );
  }
}
