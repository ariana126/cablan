import { QcActivityNameTaken } from '@maintenance/application/exceptions';
import { QcActivity } from '@maintenance/domain/qc-activity.aggregate';
import { QcActivityRepository } from '@maintenance/domain/service/qc-activity.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { DefineQcActivityCommand } from './define-qc-activity.command';

@CommandHandler(DefineQcActivityCommand)
export class DefineQcActivityHandler implements ICommandHandler<
  DefineQcActivityCommand,
  { id: string }
> {
  constructor(private readonly activityRepository: QcActivityRepository) {}

  async execute(command: DefineQcActivityCommand): Promise<{ id: string }> {
    if (await this.activityRepository.findByName(command.name)) {
      throw QcActivityNameTaken.withName(command.name);
    }

    const activity = QcActivity.define(command.name);
    await this.activityRepository.save(activity);

    return { id: activity.id.asString() };
  }
}
