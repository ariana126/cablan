import { editHistoryItemsOf } from '@boms/application/queries/bom-edit-record.read-model';
import { BomReportRepository } from '@boms/application/service/bom-report.repository';
import { isResamplable } from '@boms/domain/service/resampling.policy';
import { EntityNotFound } from '@framework/domain';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import {
  BomDetail,
  BomDetailComponentItem,
  BomDetailMaterialItem,
} from './bom-detail.read-model';
import { GetBomQuery } from './get-bom.query';

@QueryHandler(GetBomQuery)
export class GetBomHandler implements IQueryHandler<GetBomQuery> {
  constructor(private readonly bomReportRepository: BomReportRepository) {}

  async execute(query: GetBomQuery): Promise<BomDetail> {
    const record = await this.bomReportRepository.findDetailById(query.bomId);
    if (!record) {
      throw EntityNotFound.withId(query.bomId);
    }

    const components = record.components.map(
      (component) =>
        new BomDetailComponentItem(
          component.id,
          component.name,
          component.materials.map(
            (material) =>
              new BomDetailMaterialItem(
                material.id,
                material.name,
                material.weight,
              ),
          ),
        ),
    );
    const totalWeight = components.reduce(
      (sum, component) =>
        sum +
        component.materials.reduce(
          (componentSum, material) => componentSum + material.weight,
          0,
        ),
      0,
    );

    return new BomDetail(
      record.id,
      record.standardBomId,
      record.standardBomMiCode,
      record.brand,
      record.productName,
      record.standardLength,
      record.orderNumber,
      record.trackingNumber,
      record.registeredBy,
      record.registeredAt.toISOString(),
      record.description ?? undefined,
      components,
      totalWeight,
      record.approvalStatus,
      record.reviewedBy,
      record.managementNote,
      editHistoryItemsOf(record.editHistory),
      isResamplable(record.approvalStatus, record.isLatestOfTrackingNumber),
    );
  }
}
