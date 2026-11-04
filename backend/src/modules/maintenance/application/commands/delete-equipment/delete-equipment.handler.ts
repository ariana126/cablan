import { UnitOfWork } from '@framework/application';
import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { MaintenanceExecutionRepository } from '@maintenance/domain/service/maintenance-execution.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { DeleteEquipmentCommand } from './delete-equipment.command';

/**
 * Issue #110's one cascade: retired equipment, every row of its plan and
 * every execution of them go together, in one unit of work. Its
 * `EquipmentDeleted` is the only record; the executions record nothing of
 * their own.
 */
@CommandHandler(DeleteEquipmentCommand)
export class DeleteEquipmentHandler implements ICommandHandler<DeleteEquipmentCommand> {
  constructor(
    private readonly equipmentRepository: EquipmentRepository,
    private readonly executionRepository: MaintenanceExecutionRepository,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: DeleteEquipmentCommand): Promise<void> {
    await this.unitOfWork.run(async () => {
      const equipment = await this.equipmentRepository.get(command.equipmentId);
      equipment.delete();
      // By equipment, so an execution recorded meanwhile on a row this load
      // did not see goes too.
      await this.executionRepository.deleteOfEquipment(equipment.id);
      await this.equipmentRepository.delete(equipment);
    });
  }
}
