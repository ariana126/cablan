import { MaterialWeightDifference } from '@boms/application/queries/material-weight-difference.read-model';
import { GetManufacturingInstructionDetailQuery } from '@manufacturing-instructions/application/queries/get-manufacturing-instruction-detail/get-manufacturing-instruction-detail.query';
import { ManufacturingInstructionDetail } from '@manufacturing-instructions/application/queries/get-manufacturing-instruction-detail/manufacturing-instruction-detail.read-model';
import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';

/** A daily BOM's material line as recorded, before it is compared. */
export interface ActualMaterialWeight {
  readonly componentId: string;
  readonly componentName: string;
  readonly materialId: string;
  readonly materialName: string;
  readonly actualWeight: number;
}

// Weights are IEEE-754 doubles, so a bare subtraction leaks float noise onto
// the wire (6.3 - 6.1 = 0.20000000000000018). Differences and sums of them are
// rounded to `WEIGHT_DECIMALS` places — far finer than any weight a person
// enters in grams, far coarser than the noise.
const WEIGHT_DECIMALS = 6;
const WEIGHT_SCALE = 10 ** WEIGHT_DECIMALS;

export function roundWeight(grams: number): number {
  return Math.round(grams * WEIGHT_SCALE) / WEIGHT_SCALE;
}

// One standard BOM's current composition, indexed by the
// `(componentId, materialId)` pair — the same pair `BomCompositionFactory`
// clones at registration. A daily BOM's line whose pair is no longer on the
// standard BOM is compared against `standardWeight: 0` rather than skipped:
// surfacing exactly that drift is the point.
export class StandardWeightTable {
  private constructor(private readonly weightsByPair: Map<string, number>) {}

  static of(standardBom: ManufacturingInstructionDetail): StandardWeightTable {
    const weightsByPair = new Map<string, number>();
    for (const component of standardBom.components) {
      for (const material of component.materials) {
        weightsByPair.set(
          pairKey(component.componentId, material.materialId),
          material.weight,
        );
      }
    }
    return new StandardWeightTable(weightsByPair);
  }

  differenceOf(material: ActualMaterialWeight): MaterialWeightDifference {
    const standardWeight =
      this.weightsByPair.get(
        pairKey(material.componentId, material.materialId),
      ) ?? 0;
    return new MaterialWeightDifference(
      material.componentId,
      material.componentName,
      material.materialId,
      material.materialName,
      material.actualWeight,
      standardWeight,
      roundWeight(Math.abs(material.actualWeight - standardWeight)),
    );
  }
}

function pairKey(componentId: string, materialId: string): string {
  return `${componentId}::${materialId}`;
}

// The read-side crossing into `manufacturing-instructions` that every
// "deviation from standard" read shares: the dashboard's per-product rows and
// the post-registration preview. It dispatches
// `GetManufacturingInstructionDetailQuery` on the `QueryBus` — the only thing
// the `standard-bom-weights-reuse-is-narrow` carve-out in
// `.dependency-cruiser.cjs` lets this file import from that module. An MI code
// that no longer exists propagates the query's `EntityNotFound`. See
// src/modules/boms/CLAUDE.md.
@Injectable()
export class StandardBomWeights {
  constructor(private readonly queryBus: QueryBus) {}

  async ofMiCode(standardBomMiCode: string): Promise<StandardWeightTable> {
    const standardBom = await this.queryBus.execute<
      GetManufacturingInstructionDetailQuery,
      ManufacturingInstructionDetail
    >(new GetManufacturingInstructionDetailQuery(standardBomMiCode));
    return StandardWeightTable.of(standardBom);
  }
}
