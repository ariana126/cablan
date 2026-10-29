import { PmPlanReader } from '@maintenance/application/service/pm-plan-reader';
import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { EquipmentDetailReadModel } from './equipment-detail.read-model';
import { GetEquipmentQuery } from './get-equipment.query';
import { PmPlanItemReadModel } from './pm-plan-item.read-model';

@QueryHandler(GetEquipmentQuery)
export class GetEquipmentHandler implements IQueryHandler<GetEquipmentQuery> {
  constructor(
    private readonly equipmentRepository: EquipmentRepository,
    private readonly planReader: PmPlanReader,
  ) {}

  async execute(query: GetEquipmentQuery): Promise<EquipmentDetailReadModel> {
    const equipment = await this.equipmentRepository.get(query.equipmentId);
    const today = this.planReader.today();
    const [{ planItems }] = await this.planReader.read([equipment]);

    return new EquipmentDetailReadModel(
      equipment.id.asString(),
      equipment.name().asString(),
      equipment.isRetired(),
      planItems.map(
        ({ item, activityName, occurrences }) =>
          new PmPlanItemReadModel(
            item.id.asString(),
            item.activityId().asString(),
            activityName,
            item.schedule().intervalDays().asNumber(),
            item.schedule().firstDueDate().asString(),
            occurrences.nextDueDate(today).asString(),
          ),
      ),
    );
  }
}
