import { UnitOfWork } from '@framework/application';
import { ACTIVITY_SPECIALTY_LOCK } from '@maintenance/application/service/activity-specialty-lock';
import { MaintenanceActivityRepository } from '@maintenance/domain/service/maintenance-activity.repository';
import { MissingSpecialties } from '@maintenance/domain/service/missing-specialties';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { CompleteMissingSpecialtiesCommand } from './complete-missing-specialties.command';

/**
 * Gives every activity without a specialty its specialty, all or none (one
 * unit of work, so every save and its audit entry commit together; the rule
 * is `MissingSpecialties`'). It deliberately skips the PM-plan lock
 * (`RecordDependencies`) that guards the general edit: it only ever fills in
 * a specialty that is missing, which the aggregate enforces too.
 */
@CommandHandler(CompleteMissingSpecialtiesCommand)
export class CompleteMissingSpecialtiesHandler implements ICommandHandler<CompleteMissingSpecialtiesCommand> {
  constructor(
    private readonly activityRepository: MaintenanceActivityRepository,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: CompleteMissingSpecialtiesCommand): Promise<void> {
    await this.unitOfWork.runExclusively(ACTIVITY_SPECIALTY_LOCK, async () => {
      const catalog = await this.activityRepository.list();
      const completed = MissingSpecialties.in(catalog).complete(
        command.assignments,
      );
      for (const activity of completed) {
        await this.activityRepository.save(activity);
      }
    });
  }
}
