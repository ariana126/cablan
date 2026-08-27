import { BomRepository } from '@boms/domain/service/bom.repository';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { BomReadModel } from './bom.read-model';
import { ListBomsQuery } from './list-boms.query';

@QueryHandler(ListBomsQuery)
export class ListBomsHandler implements IQueryHandler<ListBomsQuery> {
  constructor(private readonly bomRepository: BomRepository) {}

  async execute(): Promise<BomReadModel[]> {
    const boms = await this.bomRepository.list();
    return boms.map((bom) => BomReadModel.fromDomain(bom));
  }
}
