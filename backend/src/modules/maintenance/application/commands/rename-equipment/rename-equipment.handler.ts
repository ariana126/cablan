import { EquipmentNameTaken } from '@maintenance/application/exceptions';
import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { RenameEquipmentCommand } from './rename-equipment.command';

@CommandHandler(RenameEquipmentCommand)
export class RenameEquipmentHandler implements ICommandHandler<RenameEquipmentCommand> {
  constructor(private readonly equipmentRepository: EquipmentRepository) {}

  async execute(command: RenameEquipmentCommand): Promise<void> {
    const equipment = await this.equipmentRepository.get(command.equipmentId);

    const namesake = await this.equipmentRepository.findByName(command.name);
    if (namesake && !namesake.id.equals(equipment.id)) {
      throw EquipmentNameTaken.withName(command.name);
    }

    equipment.rename(command.name);
    await this.equipmentRepository.save(equipment);
  }
}
