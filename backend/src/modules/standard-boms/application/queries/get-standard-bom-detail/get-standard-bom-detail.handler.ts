import { EntityNotFound, Identity } from '@framework/domain';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { StandardBomRepository } from '@standard-boms/domain/service/standard-bom.repository';
import { MiCode } from '@standard-boms/domain/value/mi-code.vo';

import { GetStandardBomDetailQuery } from './get-standard-bom-detail.query';
import {
  StandardBomDetail,
  StandardBomDetailComponentItem,
  StandardBomDetailMaterialItem,
} from './standard-bom-detail.read-model';

@QueryHandler(GetStandardBomDetailQuery)
export class GetStandardBomDetailHandler implements IQueryHandler<GetStandardBomDetailQuery> {
  constructor(private readonly standardBomRepository: StandardBomRepository) {}

  async execute(query: GetStandardBomDetailQuery): Promise<StandardBomDetail> {
    const standardBom = await this.standardBomRepository.findByMiCode(
      MiCode.fromString(query.miCode),
    );
    if (!standardBom) {
      throw EntityNotFound.withId(Identity.fromString(query.miCode));
    }

    let totalWeight = 0;
    const components = standardBom.components().map((component) => {
      const materials = component.materials().map((material) => {
        totalWeight += material.weight().asGrams();
        return new StandardBomDetailMaterialItem(
          material.materialId().asString(),
          material.name(),
          material.weight().asGrams(),
        );
      });
      return new StandardBomDetailComponentItem(
        component.componentId().asString(),
        component.name(),
        materials,
      );
    });

    return new StandardBomDetail(
      standardBom.id.asString(),
      standardBom.miCode().asString(),
      standardBom.brand().asString(),
      standardBom.productName(),
      standardBom.standardLength().asNumber(),
      standardBom.active(),
      standardBom.description() ?? null,
      components,
      totalWeight,
    );
  }
}
