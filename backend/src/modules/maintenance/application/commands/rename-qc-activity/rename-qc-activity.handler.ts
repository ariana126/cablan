import { RecordDependencies, UnitOfWork } from '@framework/application';
import { QcActivityNameTaken } from '@maintenance/application/exceptions';
import { qcActivityOrFail } from '@maintenance/application/service/qc-lookups';
import { QcActivityRepository } from '@maintenance/domain/service/qc-activity.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { RenameQcActivityCommand } from './rename-qc-activity.command';

/**
 * A QC activity assigned to equipment or recorded on it, even once
 * unassigned, cannot be renamed (issue #94) — unless it is the System
 * Admin's correction of its name (issue #110's exception, approved for QC in
 * issue #119). No record keeps a copy of the name (the reads show the
 * current one), so there is nothing to carry it into.
 */
@CommandHandler(RenameQcActivityCommand)
export class RenameQcActivityHandler implements ICommandHandler<RenameQcActivityCommand> {
  constructor(
    private readonly activityRepository: QcActivityRepository,
    private readonly recordDependencies: RecordDependencies,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: RenameQcActivityCommand): Promise<void> {
    await this.unitOfWork.run(async () => {
      const activity = await qcActivityOrFail(
        this.activityRepository,
        command.activityId,
      );
      await this.recordDependencies.editRecordInUse(
        { type: 'qc-activity', id: activity.id.asString() },
        {
          applyToRelatedRecords: command.applyToRelatedRecords,
          changesOnlyCorrectableFields: activity.changesOnlyCorrectableFields(),
          before: { name: activity.name().asString() },
          after: { name: command.name.asString() },
        },
        async () => {
          const namesake = await this.activityRepository.findByName(
            command.name,
          );
          if (namesake && !namesake.id.equals(activity.id)) {
            throw QcActivityNameTaken.withName(command.name);
          }
          activity.rename(command.name);
          await this.activityRepository.save(activity);
        },
      );
    });
  }
}
