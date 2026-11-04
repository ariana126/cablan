import { UnitOfWork } from '@framework/application';
import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { MaintenanceExecutionRepository } from '@maintenance/domain/service/maintenance-execution.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { DeletePmPlanItemCommand } from './delete-pm-plan-item.command';

/**
 * The row leaves its equipment's plan and its executions go with it, in one
 * unit of work; `PmPlanItemDeleted` is the only record.
 */
@CommandHandler(DeletePmPlanItemCommand)
export class DeletePmPlanItemHandler implements ICommandHandler<DeletePmPlanItemCommand> {
  constructor(
    private readonly equipmentRepository: EquipmentRepository,
    private readonly executionRepository: MaintenanceExecutionRepository,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: DeletePmPlanItemCommand): Promise<void> {
    await this.unitOfWork.run(async () => {
      const equipment = await this.equipmentRepository.get(command.equipmentId);
      equipment.deletePlanItem(command.planItemId);
      await this.executionRepository.deleteOfPlanItems([command.planItemId]);
      await this.equipmentRepository.save(equipment);
    });
  }
}
