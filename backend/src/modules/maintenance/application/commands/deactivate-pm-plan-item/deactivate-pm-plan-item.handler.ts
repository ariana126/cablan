import { Clock } from '@framework/domain';
import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { RemovePmPlanItemCommand } from './remove-pm-plan-item.command';

@CommandHandler(RemovePmPlanItemCommand)
export class RemovePmPlanItemHandler implements ICommandHandler<RemovePmPlanItemCommand> {
  constructor(
    private readonly equipmentRepository: EquipmentRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: RemovePmPlanItemCommand): Promise<void> {
    const equipment = await this.equipmentRepository.get(command.equipmentId);
    equipment.removePlanItem(command.planItemId, this.clock.now());
    await this.equipmentRepository.save(equipment);
  }
}
