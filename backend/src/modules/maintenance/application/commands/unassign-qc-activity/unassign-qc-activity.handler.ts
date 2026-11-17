import {
  qcActivityOrFail,
  qcEquipmentOrFail,
} from '@maintenance/application/service/qc-lookups';
import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { QcActivityRepository } from '@maintenance/domain/service/qc-activity.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { UnassignQcActivityCommand } from './unassign-qc-activity.command';

/**
 * No more records of the activity on that equipment; every record already
 * made stays, and a reassignment later continues its intervals. Not guarded
 * by issue #94: an assignment is nothing another record references.
 */
@CommandHandler(UnassignQcActivityCommand)
export class UnassignQcActivityHandler implements ICommandHandler<UnassignQcActivityCommand> {
  constructor(
    private readonly equipmentRepository: EquipmentRepository,
    private readonly activityRepository: QcActivityRepository,
  ) {}

  async execute(command: UnassignQcActivityCommand): Promise<void> {
    const equipment = await qcEquipmentOrFail(
      this.equipmentRepository,
      command.equipmentId,
    );
    const activity = await qcActivityOrFail(
      this.activityRepository,
      command.activityId,
    );
    equipment.unassignQcActivity(activity);
    await this.equipmentRepository.save(equipment);
  }
}
