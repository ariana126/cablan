import {
  BomExportRecord,
  BomReportRepository,
} from '@boms/application/service/bom-report.repository';
import {
  roundWeight,
  StandardBomWeights,
} from '@boms/application/service/standard-bom-weights';
import { EntityNotFound } from '@framework/domain';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import {
  BomExportComponent,
  BomExportItem,
  BomExportMaterial,
  BomExportResult,
} from './bom-export.read-model';
import { ExportBomsQuery } from './export-boms.query';

// The daily-BOM export set. Besides the filtered records it weighs each daily
// BOM — one metre, its standard length, and the signed difference from its
// standard BOM's *current* total at that length — reading each distinct
// standard BOM once through `StandardBomWeights`. A standard BOM that can no
// longer be found (its MI code renamed, say) leaves only that BOM's difference
// empty rather than failing the whole export. See src/modules/boms/CLAUDE.md.
@QueryHandler(ExportBomsQuery)
export class ExportBomsHandler implements IQueryHandler<ExportBomsQuery> {
  constructor(
    private readonly bomReportRepository: BomReportRepository,
    private readonly standardBomWeights: StandardBomWeights,
  ) {}

  async execute(query: ExportBomsQuery): Promise<BomExportResult> {
    const records = await this.bomReportRepository.exportRecords(query.filters);

    const standardTotalsByMiCode = new Map<string, number | null>();
    const items: BomExportItem[] = [];
    for (const record of records) {
      let standardTotal = standardTotalsByMiCode.get(record.standardBomMiCode);
      if (standardTotal === undefined) {
        standardTotal = await this.standardTotalOf(record.standardBomMiCode);
        standardTotalsByMiCode.set(record.standardBomMiCode, standardTotal);
      }
      items.push(toExportItem(record, standardTotal));
    }
    return new BomExportResult(items);
  }

  private async standardTotalOf(
    standardBomMiCode: string,
  ): Promise<number | null> {
    try {
      const table = await this.standardBomWeights.ofMiCode(standardBomMiCode);
      return table.totalWeight();
    } catch (error) {
      if (error instanceof EntityNotFound) {
        return null;
      }
      throw error;
    }
  }
}

function toExportItem(
  record: BomExportRecord,
  standardTotal: number | null,
): BomExportItem {
  const weightPerMeter = roundWeight(
    record.components
      .flatMap((component) => component.materials)
      .reduce((sum, material) => sum + material.weight, 0),
  );
  const standardLengthWeight = weightPerMeter * record.standardLength;
  const differenceFromStandard =
    standardTotal === null
      ? null
      : roundWeight(
          standardLengthWeight - standardTotal * record.standardLength,
        );

  return new BomExportItem(
    record.orderNumber,
    record.trackingNumber,
    record.registeredAt.toISOString(),
    record.registeredBy,
    record.standardBomMiCode,
    record.brand,
    record.standardLength,
    record.productName,
    record.description,
    record.approvalStatus,
    record.reviewedBy,
    record.managementNote,
    weightPerMeter,
    roundWeight(standardLengthWeight),
    differenceFromStandard,
    record.components.map(
      (component) =>
        new BomExportComponent(
          component.name,
          component.materials.map(
            (material) => new BomExportMaterial(material.name, material.weight),
          ),
        ),
    ),
  );
}
