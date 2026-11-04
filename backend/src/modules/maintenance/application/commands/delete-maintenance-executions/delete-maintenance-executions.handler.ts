import { UnitOfWork } from '@framework/application';
import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { MaintenanceExecutionRepository } from '@maintenance/domain/service/maintenance-execution.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { DeleteMaintenanceExecutionsCommand } from './delete-maintenance-executions.command';

/**
 * Every execution of the row goes, each recording its own deletion (one
 * audit entry per history row), in one unit of work. A row with none is a
 * no-op.
 */
@CommandHandler(DeleteMaintenanceExecutionsCommand)
export class DeleteMaintenanceExecutionsHandler implements ICommandHandler<DeleteMaintenanceExecutionsCommand> {
  constructor(
    private readonly equipmentRepository: EquipmentRepository,
    private readonly executionRepository: MaintenanceExecutionRepository,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: DeleteMaintenanceExecutionsCommand): Promise<void> {
    await this.unitOfWork.run(async () => {
      const equipment = await this.equipmentRepository.get(command.equipmentId);
      const item = equipment.planItem(command.planItemId);
      const executions = await this.executionRepository.forPlanItem(item.id);
      // Oldest due date first, so the audit entries read in order.
      for (const execution of executions.toSorted((left, right) =>
        right.dueDate().daysUntil(left.dueDate()),
      )) {
        execution.delete();
        await this.executionRepository.delete(execution);
      }
    });
  }
}
