import { EquipmentNameTaken } from '@maintenance/application/exceptions';
import { Equipment } from '@maintenance/domain/equipment.aggregate';
import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { RegisterEquipmentCommand } from './register-equipment.command';

@CommandHandler(RegisterEquipmentCommand)
export class RegisterEquipmentHandler implements ICommandHandler<
  RegisterEquipmentCommand,
  { id: string }
> {
  constructor(private readonly equipmentRepository: EquipmentRepository) {}

  async execute(command: RegisterEquipmentCommand): Promise<{ id: string }> {
    if (await this.equipmentRepository.findByName(command.name)) {
      throw EquipmentNameTaken.withName(command.name);
    }

    const equipment = Equipment.register(command.name);
    await this.equipmentRepository.save(equipment);

    return { id: equipment.id.asString() };
  }
}
