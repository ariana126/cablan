import { QcEquipmentReadModel } from '@maintenance/application/service/qc-equipment.read-model';
import { QcEquipmentStatuses } from '@maintenance/application/service/qc-equipment-statuses';
import { qcEquipmentOrFail } from '@maintenance/application/service/qc-lookups';
import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { GetQcEquipmentQuery } from './get-qc-equipment.query';

@QueryHandler(GetQcEquipmentQuery)
export class GetQcEquipmentHandler implements IQueryHandler<GetQcEquipmentQuery> {
  constructor(
    private readonly equipmentRepository: EquipmentRepository,
    private readonly statuses: QcEquipmentStatuses,
  ) {}

  async execute(query: GetQcEquipmentQuery): Promise<QcEquipmentReadModel> {
    const equipment = await qcEquipmentOrFail(
      this.equipmentRepository,
      query.equipmentId,
    );
    const [readModel] = await this.statuses.of([equipment]);
    return readModel;
  }
}
