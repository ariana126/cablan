import { RecordDependencies } from '@framework/application';
import { MaintenanceActivityNameTaken } from '@maintenance/application/exceptions';
import { MaintenanceActivityRepository } from '@maintenance/domain/service/maintenance-activity.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { RenameMaintenanceActivityCommand } from './rename-maintenance-activity.command';

@CommandHandler(RenameMaintenanceActivityCommand)
export class RenameMaintenanceActivityHandler implements ICommandHandler<RenameMaintenanceActivityCommand> {
  constructor(
    private readonly activityRepository: MaintenanceActivityRepository,
    private readonly recordDependencies: RecordDependencies,
  ) {}

  async execute(command: RenameMaintenanceActivityCommand): Promise<void> {
    const activity = await this.activityRepository.get(command.activityId);
    // A record another record references can be neither edited nor
    // deleted (issue #94) — checked before anything changes.
    await this.recordDependencies.assertNoDependents({
      type: 'MaintenanceActivity',
      id: activity.id.asString(),
    });

    const namesake = await this.activityRepository.findByName(command.name);
    if (namesake && !namesake.id.equals(activity.id)) {
      throw MaintenanceActivityNameTaken.withName(command.name);
    }

    activity.rename(command.name);
    await this.activityRepository.save(activity);
  }
}
