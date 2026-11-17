import { RecordDependencies } from '@framework/application';
import { QcActivityStillReferenced } from '@maintenance/application/exceptions';
import { qcActivityOrFail } from '@maintenance/application/service/qc-lookups';
import { QcActivityRepository } from '@maintenance/domain/service/qc-activity.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { DeleteQcActivityCommand } from './delete-qc-activity.command';

/**
 * Only a QC activity nothing uses goes: one assigned to equipment, or with
 * any record — even after it was unassigned —, is refused (issue #94), the
 * System Admin included. Deleting never cascades.
 *
 * The check is check-then-act: an assignment or a record made between it
 * and the delete makes the database's foreign key refuse the delete instead
 * (`QcActivityStillReferenced`). The answer is still the ordinary refusal,
 * the dependents asked again now that the delete has rolled back.
 */
@CommandHandler(DeleteQcActivityCommand)
export class DeleteQcActivityHandler implements ICommandHandler<DeleteQcActivityCommand> {
  constructor(
    private readonly activityRepository: QcActivityRepository,
    private readonly recordDependencies: RecordDependencies,
  ) {}

  async execute(command: DeleteQcActivityCommand): Promise<void> {
    const activity = await qcActivityOrFail(
      this.activityRepository,
      command.activityId,
    );
    const reference = {
      type: 'qc-activity' as const,
      id: activity.id.asString(),
    };
    await this.recordDependencies.assertNoDependents(reference);
    activity.delete();
    try {
      await this.activityRepository.delete(activity);
    } catch (error) {
      if (error instanceof QcActivityStillReferenced) {
        await this.recordDependencies.assertNoDependents(reference);
      }
      throw error;
    }
  }
}
