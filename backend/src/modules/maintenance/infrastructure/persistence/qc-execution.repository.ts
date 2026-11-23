import { DomainEventDispatcher } from '@framework/application';
import { Identity } from '@framework/domain';
import {
  ModelDelegate,
  PrismaEntityRepository,
  PrismaService,
} from '@framework/infrastructure';
import { QcExecutionNotFound } from '@maintenance/application/exceptions';
import { QcActivityAlreadyRecordedInSubmission } from '@maintenance/domain/exceptions/qc-activity-already-recorded-in-submission.exception';
import { QcExecution } from '@maintenance/domain/qc-execution.aggregate';
import { QcExecutionRepository } from '@maintenance/domain/service/qc-execution.repository';
import { QcTrackingNumber } from '@maintenance/domain/value/qc-tracking-number.vo';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';

import { isRecordNotFound } from './record-not-found';
import { isUniqueViolationOn } from './unique-violation';

/**
 * Only what the domain owns: `sequence` is the database's insertion order,
 * written by its default and read only by `PrismaQcExecutionReader`.
 */
export interface QcExecutionRecord {
  id: string;
  equipmentId: string;
  qcActivityId: string;
  performedAt: Date;
  performedById: string;
  performedByName: string;
  trackingNumber: string;
  notes: string | null;
  submissionId: string | null;
}

function toDomain(record: QcExecutionRecord): QcExecution {
  return QcExecution.fromPersistence(Identity.fromString(record.id), {
    equipmentId: Identity.fromString(record.equipmentId),
    activityId: Identity.fromString(record.qcActivityId),
    performedById: Identity.fromString(record.performedById),
    performedByName: record.performedByName,
    performedAt: record.performedAt,
    trackingNumber: QcTrackingNumber.fromString(record.trackingNumber),
    notes: record.notes,
    submissionId:
      record.submissionId === null
        ? null
        : Identity.fromString(record.submissionId),
  });
}

/** The QC records (issue #119), the write side, in `qc_execution`. */
@Injectable()
export class PrismaQcExecutionRepository
  extends PrismaEntityRepository<QcExecution, QcExecutionRecord>
  implements QcExecutionRepository
{
  constructor(
    txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    dispatcher: DomainEventDispatcher,
  ) {
    super(txHost, dispatcher);
  }

  /**
   * A second record of one activity in one submission (issue #132) — two
   * sendings of it saved at once — is refused by the unique key on
   * `(submission_id, qc_activity_id)`, rolling this save and its audit entry
   * back.
   */
  async save(entity: QcExecution): Promise<void> {
    try {
      await super.save(entity);
    } catch (error) {
      const submissionId = entity.submissionId();
      if (
        submissionId &&
        isUniqueViolationOn(error, 'submission_id', 'qc_activity_id')
      ) {
        throw QcActivityAlreadyRecordedInSubmission.of(
          submissionId.asString(),
          entity.activityId().asString(),
        );
      }
      throw error;
    }
  }

  /** A second delete of one record finds no row: a 404, like any unknown record. */
  async delete(entity: QcExecution): Promise<void> {
    try {
      await super.delete(entity);
    } catch (error) {
      if (isRecordNotFound(error)) {
        throw QcExecutionNotFound.withId(entity.id);
      }
      throw error;
    }
  }

  protected delegate(): ModelDelegate<QcExecutionRecord> {
    return this.txHost.tx.qcExecution;
  }

  protected toDomain(record: QcExecutionRecord): QcExecution {
    return toDomain(record);
  }

  protected toPersistence(entity: QcExecution): QcExecutionRecord {
    return {
      id: entity.id.asString(),
      equipmentId: entity.equipmentId().asString(),
      qcActivityId: entity.activityId().asString(),
      performedAt: entity.performedAt(),
      performedById: entity.performedById().asString(),
      performedByName: entity.performedByName(),
      trackingNumber: entity.trackingNumber().asString(),
      notes: entity.notes(),
      submissionId: entity.submissionId()?.asString() ?? null,
    };
  }

  async ofEquipment(equipmentId: Identity): Promise<QcExecution[]> {
    const records = await this.txHost.tx.qcExecution.findMany({
      where: { equipmentId: equipmentId.asString() },
      orderBy: [{ performedAt: 'asc' }, { sequence: 'asc' }],
    });
    return records.map((record) => toDomain(record));
  }

  async ofSubmission(submissionId: Identity): Promise<QcExecution[]> {
    const records = await this.txHost.tx.qcExecution.findMany({
      where: { submissionId: submissionId.asString() },
    });
    return records.map((record) => toDomain(record));
  }
}
