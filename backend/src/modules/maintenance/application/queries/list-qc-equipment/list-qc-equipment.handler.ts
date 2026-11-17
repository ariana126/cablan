import { byPersianName } from '@maintenance/application/service/persian-order';
import { QcAssignmentReader } from '@maintenance/application/service/qc-assignment-reader';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { ListQcEquipmentQuery } from './list-qc-equipment.query';
import { QcEquipmentSummaryReadModel } from './qc-equipment-summary.read-model';

/** «پرونده QC تجهیزات»: every piece of equipment, retired included. */
@QueryHandler(ListQcEquipmentQuery)
export class ListQcEquipmentHandler implements IQueryHandler<ListQcEquipmentQuery> {
  constructor(private readonly reader: QcAssignmentReader) {}

  async execute(): Promise<QcEquipmentSummaryReadModel[]> {
    const equipment = await this.reader.equipment();
    return equipment
      .map(
        (candidate) =>
          new QcEquipmentSummaryReadModel(
            candidate.id,
            candidate.name,
            candidate.retired,
            candidate.assignedActivityCount,
          ),
      )
      .toSorted((left, right) => byPersianName(left.name, right.name));
  }
}
