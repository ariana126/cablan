import {
  qcActivityOrFail,
  qcEquipmentOrFail,
} from '@maintenance/application/service/qc-lookups';
import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { QcActivityRepository } from '@maintenance/domain/service/qc-activity.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AssignQcActivityCommand } from './assign-qc-activity.command';

@CommandHandler(AssignQcActivityCommand)
export class AssignQcActivityHandler implements ICommandHandler<AssignQcActivityCommand> {
  constructor(
    private readonly equipmentRepository: EquipmentRepository,
    private readonly activityRepository: QcActivityRepository,
  ) {}

  async execute(command: AssignQcActivityCommand): Promise<void> {
    const equipment = await qcEquipmentOrFail(
      this.equipmentRepository,
      command.equipmentId,
    );
    const activity = await qcActivityOrFail(
      this.activityRepository,
      command.activityId,
    );
    equipment.assignQcActivity(activity);
    await this.equipmentRepository.save(equipment);
  }
}
