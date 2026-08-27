import { EntityNotFound, Identity } from '@framework/domain';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { StandardBomReadModel } from '@standard-boms/application/queries/list-standard-boms/standard-bom.read-model';
import { StandardBomRepository } from '@standard-boms/domain/service/standard-bom.repository';
import { MiCode } from '@standard-boms/domain/value/mi-code.vo';

import { GetStandardBomByMiCodeQuery } from './get-standard-bom-by-mi-code.query';

// Read-side counterpart to `GetProductHandler` (see
// src/modules/products/application/queries/get-product/get-product.handler.ts):
// the one query `boms`' own `BomCompositionFactory` is allowed to dispatch
// through the `QueryBus` to read a standard BOM's current composition,
// rather than reaching into this module's repository directly.
@QueryHandler(GetStandardBomByMiCodeQuery)
export class GetStandardBomByMiCodeHandler implements IQueryHandler<GetStandardBomByMiCodeQuery> {
  constructor(private readonly standardBomRepository: StandardBomRepository) {}

  async execute(
    query: GetStandardBomByMiCodeQuery,
  ): Promise<StandardBomReadModel> {
    const miCode = MiCode.fromString(query.miCode);
    const standardBom = await this.standardBomRepository.findByMiCode(miCode);
    if (!standardBom) {
      throw EntityNotFound.withId(Identity.fromString(query.miCode));
    }
    return StandardBomReadModel.fromDomain(standardBom);
  }
}
