import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { MaintenanceExecutionRepository } from '@maintenance/domain/service/maintenance-execution.repository';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { GetEquipmentMaintenanceHistoryQuery } from './get-equipment-maintenance-history.query';
import { MaintenanceExecutionReadModel } from './maintenance-execution.read-model';

/**
 * Every job done on one piece of equipment, newest first — removed items'
 * and retired equipment's included. Each execution answers for itself
 * whether it was on time.
 */
@QueryHandler(GetEquipmentMaintenanceHistoryQuery)
export class GetEquipmentMaintenanceHistoryHandler implements IQueryHandler<GetEquipmentMaintenanceHistoryQuery> {
  constructor(
    private readonly equipmentRepository: EquipmentRepository,
    private readonly executionRepository: MaintenanceExecutionRepository,
  ) {}

  async execute(
    query: GetEquipmentMaintenanceHistoryQuery,
  ): Promise<MaintenanceExecutionReadModel[]> {
    const equipment = await this.equipmentRepository.get(query.equipmentId);
    const executions = await this.executionRepository.forEquipment(
      equipment.id,
    );
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
          ),
      );
  }
}
