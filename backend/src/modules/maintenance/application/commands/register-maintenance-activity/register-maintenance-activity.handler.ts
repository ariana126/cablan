import { MaintenanceActivityNameTaken } from '@maintenance/application/exceptions';
import { MaintenanceActivity } from '@maintenance/domain/maintenance-activity.aggregate';
import { MaintenanceActivityRepository } from '@maintenance/domain/service/maintenance-activity.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { RegisterMaintenanceActivityCommand } from './register-maintenance-activity.command';

@CommandHandler(RegisterMaintenanceActivityCommand)
export class RegisterMaintenanceActivityHandler implements ICommandHandler<
  RegisterMaintenanceActivityCommand,
  { id: string }
> {
  constructor(
    private readonly activityRepository: MaintenanceActivityRepository,
  ) {}

  async execute(
    command: RegisterMaintenanceActivityCommand,
  ): Promise<{ id: string }> {
    if (await this.activityRepository.findByName(command.name)) {
      throw MaintenanceActivityNameTaken.withName(command.name);
    }

    const activity = MaintenanceActivity.register(command.name);
    await this.activityRepository.save(activity);

    return { id: activity.id.asString() };
  }
}
