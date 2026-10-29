import { Clock } from '@framework/domain';
import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { RetireEquipmentCommand } from './retire-equipment.command';

@CommandHandler(RetireEquipmentCommand)
export class RetireEquipmentHandler implements ICommandHandler<RetireEquipmentCommand> {
  constructor(
    private readonly equipmentRepository: EquipmentRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: RetireEquipmentCommand): Promise<void> {
    const equipment = await this.equipmentRepository.get(command.equipmentId);
    equipment.retire(this.clock.now());
    await this.equipmentRepository.save(equipment);
  }
}
