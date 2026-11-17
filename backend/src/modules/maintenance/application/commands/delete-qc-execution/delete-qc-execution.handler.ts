import { QcExecutionNotFound } from '@maintenance/application/exceptions';
import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { QcActivityRepository } from '@maintenance/domain/service/qc-activity.repository';
import { QcExecutionRepository } from '@maintenance/domain/service/qc-execution.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { DeleteQcExecutionCommand } from './delete-qc-execution.command';

/**
 * The record goes and nothing else changes: the intervals, counts and last
 * executions simply follow the records left, and an activity still assigned
 * stays locked by its assignment. Its deletion is recorded under its
 * equipment's and activity's current names — both still exist, since
 * neither can be deleted while it has a record (retired equipment takes its
 * records with it).
 */
@CommandHandler(DeleteQcExecutionCommand)
export class DeleteQcExecutionHandler implements ICommandHandler<DeleteQcExecutionCommand> {
  constructor(
    private readonly equipmentRepository: EquipmentRepository,
    private readonly activityRepository: QcActivityRepository,
    private readonly executionRepository: QcExecutionRepository,
  ) {}

  async execute(command: DeleteQcExecutionCommand): Promise<void> {
    const execution = await this.executionRepository.find(command.executionId);
    if (!execution) {
      throw QcExecutionNotFound.withId(command.executionId);
    }
    const equipment = await this.equipmentRepository.get(
      execution.equipmentId(),
    );
    const activity = await this.activityRepository.get(execution.activityId());

    execution.delete({
      equipmentName: equipment.name().asString(),
      activityName: activity.name().asString(),
    });
    await this.executionRepository.delete(execution);
  }
}
