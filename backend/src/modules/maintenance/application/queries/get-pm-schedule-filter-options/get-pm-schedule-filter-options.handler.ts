import { byPersianName } from '@maintenance/application/service/persian-order';
import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { MaintenanceActivityRepository } from '@maintenance/domain/service/maintenance-activity.repository';
import { MaintenanceExecutionRepository } from '@maintenance/domain/service/maintenance-execution.repository';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { GetPmScheduleFilterOptionsQuery } from './get-pm-schedule-filter-options.query';
import {
  PmScheduleFilterOptionsReadModel,
  PmScheduleNamedOption,
} from './pm-schedule-filter-options.read-model';

/**
 * What the PM schedule's filters offer, to everyone who may see the
 * schedule (the equipment and activity lists themselves are planner-only):
 * every piece of equipment, retired flagged; the activity catalog; and every
 * distinct performer of an execution, named as in their latest one.
 */
@QueryHandler(GetPmScheduleFilterOptionsQuery)
export class GetPmScheduleFilterOptionsHandler implements IQueryHandler<GetPmScheduleFilterOptionsQuery> {
  constructor(
    private readonly equipmentRepository: EquipmentRepository,
    private readonly activityRepository: MaintenanceActivityRepository,
    private readonly executionRepository: MaintenanceExecutionRepository,
  ) {}

  async execute(): Promise<PmScheduleFilterOptionsReadModel> {
    const equipment = await this.equipmentRepository.list();
    const activities = await this.activityRepository.list();
    const performers = await this.executionRepository.performers();

    return new PmScheduleFilterOptionsReadModel(
      equipment
        .map((candidate) => ({
          id: candidate.id.asString(),
          name: candidate.name().asString(),
          retired: candidate.isRetired(),
        }))
        .toSorted(byName),
      activities
        .map((activity) => ({
          id: activity.id.asString(),
          name: activity.name().asString(),
        }))
        .toSorted(byName),
      performers
        .map((performer) => ({
          id: performer.id.asString(),
          name: performer.name,
        }))
        .toSorted(byName),
    );
  }
}

function byName(
  left: PmScheduleNamedOption,
  right: PmScheduleNamedOption,
): number {
  return byPersianName(left.name, right.name);
}
