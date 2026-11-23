import { Clock, DisplayNameProvider } from '@framework/domain';
import {
  qcActivityOrFail,
  qcEquipmentOrFail,
} from '@maintenance/application/service/qc-lookups';
import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { QcActivityRepository } from '@maintenance/domain/service/qc-activity.repository';
import { QcExecutionRepository } from '@maintenance/domain/service/qc-execution.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { RecordQcExecutionCommand } from './record-qc-execution.command';

/**
 * The equipment decides whether it takes the record — in service, and the
 * activity assigned to it —; only the record is saved. No minimum gap: any
 * number of records of one activity may follow each other.
 *
 * Accepted race, as with PM recording: the equipment is not locked, so a
 * record can commit after a concurrent unassignment or retirement it
 * checked before. It is a true record of work done, and the reads and the
 * locks treat it like any other.
 */
@CommandHandler(RecordQcExecutionCommand)
export class RecordQcExecutionHandler implements ICommandHandler<
  RecordQcExecutionCommand,
  { id: string }
> {
  constructor(
    private readonly equipmentRepository: EquipmentRepository,
    private readonly activityRepository: QcActivityRepository,
    private readonly executionRepository: QcExecutionRepository,
    private readonly clock: Clock,
    private readonly displayNameProvider: DisplayNameProvider,
  ) {}

  async execute(command: RecordQcExecutionCommand): Promise<{ id: string }> {
    const equipment = await qcEquipmentOrFail(
      this.equipmentRepository,
      command.equipmentId,
    );
    const activity = await qcActivityOrFail(
      this.activityRepository,
      command.activityId,
    );
    const performerName = await this.displayNameProvider.getName(
      command.performedById,
    );

    const execution = equipment.recordQcExecutionOf(
      activity,
      this.clock.now(),
      { id: command.performedById, name: performerName },
      {
        trackingNumber: command.trackingNumber,
        notes: command.notes ?? null,
        submissionId: null,
      },
    );
    await this.executionRepository.save(execution);

    return { id: execution.id.asString() };
  }
}
