import { Clock, DisplayNameProvider, Identity } from '@framework/domain';
import { QcSubmissionMismatch } from '@maintenance/application/exceptions';
import { qcEquipmentOrFail } from '@maintenance/application/service/qc-lookups';
import { Equipment } from '@maintenance/domain/equipment.aggregate';
import { QcActivityAlreadyRecordedInSubmission } from '@maintenance/domain/exceptions/qc-activity-already-recorded-in-submission.exception';
import { QcActivityNotAssigned } from '@maintenance/domain/exceptions/qc-activity-not-assigned.exception';
import { Performer } from '@maintenance/domain/maintenance-execution.aggregate';
import { QcActivity } from '@maintenance/domain/qc-activity.aggregate';
import { QcExecution } from '@maintenance/domain/qc-execution.aggregate';
import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { QcActivityRepository } from '@maintenance/domain/service/qc-activity.repository';
import { QcExecutionRepository } from '@maintenance/domain/service/qc-execution.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import {
  QcActivityRecordingResult,
  QcExecutionsRecording,
} from './qc-executions-recording.result';
import {
  QcActivityToRecord,
  RecordQcExecutionsCommand,
} from './record-qc-executions.command';

/** What every record of one submission shares. */
interface SharedRecording {
  readonly equipment: Equipment;
  readonly command: RecordQcExecutionsCommand;
  readonly performedAt: Date;
  readonly performer: Performer;
}

/**
 * Several QC activities of one equipment recorded in one submission (issue
 * #132): one independent record per ticked activity, all at one instant, by
 * one performer, for one tracking number, each with its own notes.
 *
 * In this order:
 * 1. An unknown equipment is the 404.
 * 2. The submission's earlier records, if it was sent before. One made for
 *    another equipment, inspector or tracking number refuses the whole
 *    sending (`QcSubmissionMismatch`), recording nothing.
 * 3. Only if some activity has no record in it yet, the equipment is asked
 *    whether it takes QC records at all — retired, nothing is recorded. So a
 *    resend after a retirement still gets its original answer.
 * 4. Each activity on its own, in the order submitted: one recorded before is
 *    reported with that record; otherwise it goes through the same gate as a
 *    single record (`Equipment.recordQcExecutionOf`), an unknown or
 *    unassigned one reported refused.
 *
 * **Each record is its own `save()`, deliberately not one `UnitOfWork`.** A
 * save is its own transaction with its own audit entry (ADR 0007), so one
 * activity's refusal or failure never undoes another's record. Wrapping the
 * loop in a unit of work would break that, and would also break the recovery
 * below: a unique violation aborts the Postgres transaction it happens in, so
 * the re-read could not run in it.
 *
 * Two sendings of one submission at once: the one that saves second hits the
 * unique key on (submission, activity) — `QcActivityAlreadyRecordedInSubmission`
 * — and reports the record the first one made instead.
 *
 * Same accepted race as `RecordQcExecutionHandler`: the equipment is not
 * locked.
 */
@CommandHandler(RecordQcExecutionsCommand)
export class RecordQcExecutionsHandler implements ICommandHandler<
  RecordQcExecutionsCommand,
  QcExecutionsRecording
> {
  constructor(
    private readonly equipmentRepository: EquipmentRepository,
    private readonly activityRepository: QcActivityRepository,
    private readonly executionRepository: QcExecutionRepository,
    private readonly clock: Clock,
    private readonly displayNameProvider: DisplayNameProvider,
  ) {}

  async execute(
    command: RecordQcExecutionsCommand,
  ): Promise<QcExecutionsRecording> {
    const equipment = await qcEquipmentOrFail(
      this.equipmentRepository,
      command.equipmentId,
    );
    const recordedBefore = await this.executionRepository.ofSubmission(
      command.submissionId,
    );
    if (!recordedBefore.every((record) => record.wasSentAs(command))) {
      throw QcSubmissionMismatch.of(command.submissionId);
    }
    if (
      command.activities.some(
        (ticked) => !recordOf(recordedBefore, ticked.activityId),
      )
    ) {
      equipment.assertTakesQcRecords();
    }
    const shared: SharedRecording = {
      equipment,
      command,
      performedAt: this.clock.now(),
      performer: {
        id: command.performedById,
        name: await this.displayNameProvider.getName(command.performedById),
      },
    };

    const results: QcActivityRecordingResult[] = [];
    for (const ticked of command.activities) {
      results.push(await this.recordOne(ticked, recordedBefore, shared));
    }
    return { results };
  }

  private async recordOne(
    ticked: QcActivityToRecord,
    recordedBefore: readonly QcExecution[],
    shared: SharedRecording,
  ): Promise<QcActivityRecordingResult> {
    const activity = await this.activityRepository.find(ticked.activityId);
    if (!activity) {
      return QcActivityRecordingResult.activityNotFound(ticked.activityId);
    }
    const earlier = recordOf(recordedBefore, activity.id);
    if (earlier) {
      return QcActivityRecordingResult.recorded(activity, earlier.id);
    }
    try {
      const executionId = await this.record(activity, ticked, shared);
      return QcActivityRecordingResult.recorded(activity, executionId);
    } catch (error) {
      if (error instanceof QcActivityNotAssigned) {
        return QcActivityRecordingResult.notAssigned(activity);
      }
      if (error instanceof QcActivityAlreadyRecordedInSubmission) {
        const meanwhile = recordOf(
          await this.executionRepository.ofSubmission(
            shared.command.submissionId,
          ),
          activity.id,
        );
        if (meanwhile) {
          return QcActivityRecordingResult.recorded(activity, meanwhile.id);
        }
      }
      throw error;
    }
  }

  private async record(
    activity: QcActivity,
    ticked: QcActivityToRecord,
    shared: SharedRecording,
  ): Promise<Identity> {
    const execution = shared.equipment.recordQcExecutionOf(
      activity,
      shared.performedAt,
      shared.performer,
      {
        trackingNumber: shared.command.trackingNumber,
        notes: ticked.notes ?? null,
        submissionId: shared.command.submissionId,
      },
    );
    await this.executionRepository.save(execution);
    return execution.id;
  }
}

function recordOf(
  records: readonly QcExecution[],
  activityId: Identity,
): QcExecution | undefined {
  return records.find((record) => record.activityId().equals(activityId));
}
