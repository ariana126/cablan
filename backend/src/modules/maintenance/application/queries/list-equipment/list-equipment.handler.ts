import { byPersianName } from '@maintenance/application/service/persian-order';
import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { EquipmentReadModel } from './equipment.read-model';
import { ListEquipmentQuery } from './list-equipment.query';

@QueryHandler(ListEquipmentQuery)
export class ListEquipmentHandler implements IQueryHandler<ListEquipmentQuery> {
  constructor(private readonly equipmentRepository: EquipmentRepository) {}

  async execute(): Promise<EquipmentReadModel[]> {
    const equipment = await this.equipmentRepository.list();
    return equipment
      .map(
        (candidate) =>
          new EquipmentReadModel(
            candidate.id.asString(),
            candidate.name().asString(),
            candidate.isRetired(),
            candidate.activePlanItems().length,
          ),
      )
      .toSorted((left, right) => byPersianName(left.name, right.name));
  }
}
