import { DomainEventDispatcher } from '@framework/application';
import { Identity } from '@framework/domain';
import {
  ModelDelegate,
  PrismaEntityRepository,
  PrismaService,
} from '@framework/infrastructure';
import {
  QcActivityNameTaken,
  QcActivityNotFound,
  QcActivityStillReferenced,
} from '@maintenance/application/exceptions';
import { QcActivity } from '@maintenance/domain/qc-activity.aggregate';
import { QcActivityRepository } from '@maintenance/domain/service/qc-activity.repository';
import { QcActivityName } from '@maintenance/domain/value/qc-activity-name.vo';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';

import { isForeignKeyViolation } from './foreign-key-violation';
import { isRecordNotFound } from './record-not-found';
import { isUniqueViolationOn } from './unique-violation';

// Only what the domain owns; `createdAt`/`updatedAt` are the database's.
export interface QcActivityRecord {
  id: string;
  name: string;
}

function toDomain(record: QcActivityRecord): QcActivity {
  return QcActivity.fromPersistence(
    Identity.fromString(record.id),
    QcActivityName.fromString(record.name),
  );
}

/** The QC activity catalog (issue #119), in `qc_activity`. */
@Injectable()
export class PrismaQcActivityRepository
  extends PrismaEntityRepository<QcActivity, QcActivityRecord>
  implements QcActivityRepository
{
  constructor(
    txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    dispatcher: DomainEventDispatcher,
  ) {
    super(txHost, dispatcher);
  }

  /** The unique index on `name` is the backstop for the handlers' check. */
  async save(entity: QcActivity): Promise<void> {
    try {
      await super.save(entity);
    } catch (error) {
      if (isUniqueViolationOn(error, 'name')) {
        throw QcActivityNameTaken.withName(entity.name());
      }
      throw error;
    }
  }

  /**
   * An assignment or a record made after the handler's dependents check
   * makes the foreign key refuse the delete (`QcActivityStillReferenced`,
   * which the handler answers as the ordinary 409); a second delete of one
   * activity finds no row (404).
   */
  async delete(entity: QcActivity): Promise<void> {
    try {
      await super.delete(entity);
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw QcActivityStillReferenced.withId(entity.id);
      }
      if (isRecordNotFound(error)) {
        throw QcActivityNotFound.withId(entity.id);
      }
      throw error;
    }
  }

  protected delegate(): ModelDelegate<QcActivityRecord> {
    return this.txHost.tx.qcActivity;
  }

  protected toDomain(record: QcActivityRecord): QcActivity {
    return toDomain(record);
  }

  protected toPersistence(entity: QcActivity): QcActivityRecord {
    return { id: entity.id.asString(), name: entity.name().asString() };
  }

  async findByName(name: QcActivityName): Promise<QcActivity | null> {
    const record = await this.txHost.tx.qcActivity.findUnique({
      where: { name: name.asString() },
    });
    return record ? toDomain(record) : null;
  }

  async list(): Promise<QcActivity[]> {
    const records = await this.txHost.tx.qcActivity.findMany();
    return records.map((record) => toDomain(record));
  }
}
