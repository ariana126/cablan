import { RecordDependencies } from '@framework/application';
import { EquipmentNameTaken } from '@maintenance/application/exceptions';
import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { RenameEquipmentCommand } from './rename-equipment.command';

@CommandHandler(RenameEquipmentCommand)
export class RenameEquipmentHandler implements ICommandHandler<RenameEquipmentCommand> {
  constructor(
    private readonly equipmentRepository: EquipmentRepository,
    private readonly recordDependencies: RecordDependencies,
  ) {}

  async execute(command: RenameEquipmentCommand): Promise<void> {
    const equipment = await this.equipmentRepository.get(command.equipmentId);
    // A record another record references can be neither edited nor
    // deleted (issue #94) — checked before anything changes.
    await this.recordDependencies.assertNoDependents({
      type: 'Equipment',
      id: equipment.id.asString(),
    });

    const namesake = await this.equipmentRepository.findByName(command.name);
    if (namesake && !namesake.id.equals(equipment.id)) {
      throw EquipmentNameTaken.withName(command.name);
    }

    equipment.rename(command.name);
    await this.equipmentRepository.save(equipment);
  }
}
