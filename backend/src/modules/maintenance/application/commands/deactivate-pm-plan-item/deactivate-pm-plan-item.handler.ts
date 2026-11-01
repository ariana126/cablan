import { Clock } from '@framework/domain';
import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { DeactivatePmPlanItemCommand } from './deactivate-pm-plan-item.command';

@CommandHandler(DeactivatePmPlanItemCommand)
export class DeactivatePmPlanItemHandler implements ICommandHandler<DeactivatePmPlanItemCommand> {
  constructor(
    private readonly equipmentRepository: EquipmentRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: DeactivatePmPlanItemCommand): Promise<void> {
    const equipment = await this.equipmentRepository.get(command.equipmentId);
    equipment.deactivatePlanItem(command.planItemId, this.clock.now());
    await this.equipmentRepository.save(equipment);
  }
}
