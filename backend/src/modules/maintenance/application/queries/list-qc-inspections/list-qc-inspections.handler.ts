import { byPersianName } from '@maintenance/application/service/persian-order';
import { QcEquipmentReadModel } from '@maintenance/application/service/qc-equipment.read-model';
import { QcEquipmentStatuses } from '@maintenance/application/service/qc-equipment-statuses';
import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { ListQcInspectionsQuery } from './list-qc-inspections.query';

/**
 * «بازرسی حین تولید»: what the inspectors may record — every piece of
 * equipment in service with at least one QC activity, by Persian name.
 */
@QueryHandler(ListQcInspectionsQuery)
export class ListQcInspectionsHandler implements IQueryHandler<ListQcInspectionsQuery> {
  constructor(
    private readonly equipmentRepository: EquipmentRepository,
    private readonly statuses: QcEquipmentStatuses,
  ) {}

  async execute(): Promise<QcEquipmentReadModel[]> {
    const equipment = await this.equipmentRepository.list();
    const inspected = equipment
      .filter(
        (candidate) =>
          !candidate.isRetired() && candidate.qcActivityIds().length > 0,
      )
      .toSorted((left, right) =>
        byPersianName(left.name().asString(), right.name().asString()),
      );
    return this.statuses.of(inspected);
  }
}
