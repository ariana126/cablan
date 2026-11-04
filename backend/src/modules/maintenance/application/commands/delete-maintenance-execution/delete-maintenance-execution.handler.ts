import { UnitOfWork } from '@framework/application';
import { EntityNotFound } from '@framework/domain';
import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { MaintenanceExecutionRepository } from '@maintenance/domain/service/maintenance-execution.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { DeleteMaintenanceExecutionCommand } from './delete-maintenance-execution.command';

/**
 * Active or inactive row, in service or retired: the execution goes, and
 * nothing else changes — every status is computed, so its occurrence simply
 * has no execution again. An execution not of that row of that equipment is
 * unknown (404).
 */
@CommandHandler(DeleteMaintenanceExecutionCommand)
export class DeleteMaintenanceExecutionHandler implements ICommandHandler<DeleteMaintenanceExecutionCommand> {
  constructor(
    private readonly equipmentRepository: EquipmentRepository,
    private readonly executionRepository: MaintenanceExecutionRepository,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: DeleteMaintenanceExecutionCommand): Promise<void> {
    await this.unitOfWork.run(async () => {
      const equipment = await this.equipmentRepository.get(command.equipmentId);
      const item = equipment.planItem(command.planItemId);
      const execution = await this.executionRepository.get(command.executionId);
      if (!execution.planItemId().equals(item.id)) {
        throw EntityNotFound.withId(command.executionId);
      }
      execution.delete();
      await this.executionRepository.delete(execution);
    });
  }
}
