import { RecordDependencies, UnitOfWork } from '@framework/application';
import { MaintenanceActivityNameTaken } from '@maintenance/application/exceptions';
import { ACTIVITY_SPECIALTY_LOCK } from '@maintenance/application/service/activity-specialty-lock';
import { PM_SNAPSHOT_NAMES_LOCK } from '@maintenance/application/service/pm-snapshot-names-lock';
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
    // neither saves over a specialty the other just gave the activity — and
    // under the one execution recording holds, so no execution recorded
    // meanwhile keeps the old name a correction rewrites (issue #110).
    await this.unitOfWork.runExclusively(ACTIVITY_SPECIALTY_LOCK, () =>
      this.unitOfWork.runExclusively(PM_SNAPSHOT_NAMES_LOCK, async () => {
        const activity = await this.activityRepository.get(command.activityId);
        // A record another record references can be neither edited nor
        // deleted (issue #94). Its name and its specialty therefore lock
        // together, the moment a PM plan holds it; the System Admin's
        // correction (issue #110) covers the name alone.
        await this.recordDependencies.editRecordInUse(
          { type: 'MaintenanceActivity', id: activity.id.asString() },
          {
            applyToRelatedRecords: command.applyToRelatedRecords,
            changesOnlyCorrectableFields: activity.changesOnlyCorrectableFields(
              command.specialty,
            ),
            before: { name: activity.name().asString() },
            after: { name: command.name.asString() },
          },
          async () => {
            const namesake = await this.activityRepository.findByName(
              command.name,
            );
            if (namesake && !namesake.id.equals(activity.id)) {
              throw MaintenanceActivityNameTaken.withName(command.name);
            }
            activity.edit(command.name, command.specialty);
            await this.activityRepository.save(activity);
          },
        );
      }),
    );
  }
}
