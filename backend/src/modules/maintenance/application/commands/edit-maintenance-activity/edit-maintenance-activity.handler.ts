import { RecordDependencies, UnitOfWork } from '@framework/application';
import { MaintenanceActivityNameTaken } from '@maintenance/application/exceptions';
import { ACTIVITY_SPECIALTY_LOCK } from '@maintenance/application/service/activity-specialty-lock';
import { MaintenanceActivityRepository } from '@maintenance/domain/service/maintenance-activity.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { EditMaintenanceActivityCommand } from './edit-maintenance-activity.command';

@CommandHandler(EditMaintenanceActivityCommand)
export class EditMaintenanceActivityHandler implements ICommandHandler<EditMaintenanceActivityCommand> {
  constructor(
    private readonly activityRepository: MaintenanceActivityRepository,
    private readonly recordDependencies: RecordDependencies,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: EditMaintenanceActivityCommand): Promise<void> {
    // Loaded under the lock the completion of missing specialties holds, so
    // neither saves over a specialty the other just gave the activity.
    await this.unitOfWork.runExclusively(ACTIVITY_SPECIALTY_LOCK, async () => {
      const activity = await this.activityRepository.get(command.activityId);
      // A record another record references can be neither edited nor
      // deleted (issue #94) — checked before anything changes. Its name and
      // its specialty therefore lock together, the moment a PM plan holds it.
      await this.recordDependencies.assertNoDependents({
        type: 'MaintenanceActivity',
        id: activity.id.asString(),
      });

      const namesake = await this.activityRepository.findByName(command.name);
      if (namesake && !namesake.id.equals(activity.id)) {
        throw MaintenanceActivityNameTaken.withName(command.name);
      }

      activity.edit(command.name, command.specialty);
      await this.activityRepository.save(activity);
    });
  }
}
