import { byPersianName } from '@maintenance/application/service/persian-order';
import { QcExecutionReader } from '@maintenance/application/service/qc-execution-reader';
import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { QcActivityRepository } from '@maintenance/domain/service/qc-activity.repository';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { GetQcExecutionFilterOptionsQuery } from './get-qc-execution-filter-options.query';
import {
  QcExecutionFilterOptionsReadModel,
  QcNamedOption,
} from './qc-execution-filter-options.read-model';

@QueryHandler(GetQcExecutionFilterOptionsQuery)
export class GetQcExecutionFilterOptionsHandler implements IQueryHandler<GetQcExecutionFilterOptionsQuery> {
  constructor(
    private readonly equipmentRepository: EquipmentRepository,
    private readonly activityRepository: QcActivityRepository,
    private readonly reader: QcExecutionReader,
  ) {}

  async execute(): Promise<QcExecutionFilterOptionsReadModel> {
    const equipment = await this.equipmentRepository.list();
    const activities = await this.activityRepository.list();
    const performers = await this.reader.performers();

    return {
      equipment: equipment
        .map((candidate) => ({
          id: candidate.id.asString(),
          name: candidate.name().asString(),
          retired: candidate.isRetired(),
        }))
        .toSorted(byName),
      activities: activities
        .map((activity) => ({
          id: activity.id.asString(),
          name: activity.name().asString(),
        }))
        .toSorted(byName),
      performers: performers
        .map((performer) => ({ id: performer.id, name: performer.name }))
        .toSorted(byName),
    };
  }
}

function byName(left: QcNamedOption, right: QcNamedOption): number {
  return byPersianName(left.name, right.name);
}
