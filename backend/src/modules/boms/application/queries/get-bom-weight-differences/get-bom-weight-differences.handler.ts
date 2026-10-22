import { BomReportRepository } from '@boms/application/service/bom-report.repository';
import { StandardBomWeights } from '@boms/application/service/standard-bom-weights';
import { EntityNotFound } from '@framework/domain';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { BomWeightDifferences } from './bom-weight-differences.read-model';
import { GetBomWeightDifferencesQuery } from './get-bom-weight-differences.query';

// The post-registration preview: one daily BOM's material lines measured
// against the standard BOM it was cloned from, through the same
// `StandardBomWeights` comparison the dashboard's per-product rows use, so the
// two show identical numbers. Reads the BOM through `BomReportRepository`'s
// detail projection (the one `GET /boms/:id` uses) — read-only, no aggregate.
@QueryHandler(GetBomWeightDifferencesQuery)
export class GetBomWeightDifferencesHandler implements IQueryHandler<GetBomWeightDifferencesQuery> {
  constructor(
    private readonly bomReportRepository: BomReportRepository,
    private readonly standardBomWeights: StandardBomWeights,
  ) {}

  async execute(
    query: GetBomWeightDifferencesQuery,
  ): Promise<BomWeightDifferences> {
    const record = await this.bomReportRepository.findDetailById(query.bomId);
    if (!record) {
      throw EntityNotFound.withId(query.bomId);
    }

    const standardWeights = await this.standardBomWeights.ofMiCode(
      record.standardBomMiCode,
    );
    return new BomWeightDifferences(
      record.components.flatMap((component) =>
        component.materials.map((material) =>
          standardWeights.differenceOf({
            componentId: component.id,
            componentName: component.name,
            materialId: material.id,
            materialName: material.name,
            actualWeight: material.weight,
          }),
        ),
      ),
    );
  }
}
