import { UnitOfWork } from '@framework/application';
import { Clock } from '@framework/domain';
import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { ReactivateEquipmentCommand } from './reactivate-equipment.command';

@CommandHandler(ReactivateEquipmentCommand)
export class ReactivateEquipmentHandler implements ICommandHandler<ReactivateEquipmentCommand> {
  constructor(
    private readonly equipmentRepository: EquipmentRepository,
    private readonly clock: Clock,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: ReactivateEquipmentCommand): Promise<void> {
    await this.unitOfWork.run(async () => {
      const equipment = await this.equipmentRepository.get(command.equipmentId);
      equipment.reactivate(this.clock.now(), command.rescheduledItems);
      await this.equipmentRepository.save(equipment);
    });
  }
}
