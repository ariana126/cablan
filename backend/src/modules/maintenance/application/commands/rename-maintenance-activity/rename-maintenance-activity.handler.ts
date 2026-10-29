import { MaintenanceActivityNameTaken } from '@maintenance/application/exceptions';
import { MaintenanceActivityRepository } from '@maintenance/domain/service/maintenance-activity.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { RenameMaintenanceActivityCommand } from './rename-maintenance-activity.command';

@CommandHandler(RenameMaintenanceActivityCommand)
export class RenameMaintenanceActivityHandler implements ICommandHandler<RenameMaintenanceActivityCommand> {
  constructor(
    private readonly activityRepository: MaintenanceActivityRepository,
  ) {}

  async execute(command: RenameMaintenanceActivityCommand): Promise<void> {
    const activity = await this.activityRepository.get(command.activityId);

    const namesake = await this.activityRepository.findByName(command.name);
    if (namesake && !namesake.id.equals(activity.id)) {
      throw MaintenanceActivityNameTaken.withName(command.name);
    }

    activity.rename(command.name);
    await this.activityRepository.save(activity);
  }
}
