import { readActivityCatalog } from '@maintenance/application/service/activity-catalog';
import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { MaintenanceActivityRepository } from '@maintenance/domain/service/maintenance-activity.repository';
import { MaintenanceExecutionRepository } from '@maintenance/domain/service/maintenance-execution.repository';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { GetEquipmentMaintenanceHistoryQuery } from './get-equipment-maintenance-history.query';
import { MaintenanceExecutionReadModel } from './maintenance-execution.read-model';

/**
 * Every job done on one piece of equipment, newest first — deactivated items'
 * and retired equipment's included. Each execution answers for itself
 * whether it was on time. Its activity's specialty is the catalog's current
 * one, not a snapshot: it cannot change once a PM plan holds the activity,
 * so it is also the specialty the job was done under — and an activity
 * registered before specialties existed shows the one assigned since.
 */
@QueryHandler(GetEquipmentMaintenanceHistoryQuery)
export class GetEquipmentMaintenanceHistoryHandler implements IQueryHandler<GetEquipmentMaintenanceHistoryQuery> {
  constructor(
    private readonly equipmentRepository: EquipmentRepository,
    private readonly executionRepository: MaintenanceExecutionRepository,
    private readonly activityRepository: MaintenanceActivityRepository,
  ) {}

  async execute(
    query: GetEquipmentMaintenanceHistoryQuery,
  ): Promise<MaintenanceExecutionReadModel[]> {
    const equipment = await this.equipmentRepository.get(query.equipmentId);
    const executions = await this.executionRepository.forEquipment(
      equipment.id,
    );
    const catalog = await readActivityCatalog(this.activityRepository);
    return executions
      .toSorted(
        (left, right) =>
          right.performedAt().getTime() - left.performedAt().getTime(),
      )
      .map(
        (execution) =>
          new MaintenanceExecutionReadModel(
            execution.id.asString(),
            execution.activityName(),
            execution.dueDate().asString(),
            execution.performedAt().toISOString(),
            execution.performedByName(),
            execution.status(),
            execution.notes(),
            execution.daysLate(),
            catalog.get(execution.activityId().asString())?.specialty ?? null,
            execution.operatingHours()?.asNumber() ?? null,
          ),
      );
  }
}
