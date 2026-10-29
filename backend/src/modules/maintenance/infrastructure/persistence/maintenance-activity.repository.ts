import { DomainEventDispatcher } from '@framework/application';
import { Identity } from '@framework/domain';
import {
  ModelDelegate,
  PrismaEntityRepository,
  PrismaService,
} from '@framework/infrastructure';
import { MaintenanceActivityNameTaken } from '@maintenance/application/exceptions';
import { MaintenanceActivity } from '@maintenance/domain/maintenance-activity.aggregate';
import { MaintenanceActivityRepository } from '@maintenance/domain/service/maintenance-activity.repository';
import { MaintenanceActivityName } from '@maintenance/domain/value/maintenance-activity-name.vo';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';

import { isUniqueViolationOn } from './unique-violation';

// Only what the domain owns; `createdAt`/`updatedAt` are the database's.
export interface MaintenanceActivityRecord {
  id: string;
  name: string;
}

function toDomain(record: MaintenanceActivityRecord): MaintenanceActivity {
  return MaintenanceActivity.fromPersistence(
    Identity.fromString(record.id),
    MaintenanceActivityName.fromString(record.name),
  );
}

@Injectable()
export class PrismaMaintenanceActivityRepository
  extends PrismaEntityRepository<MaintenanceActivity, MaintenanceActivityRecord>
  implements MaintenanceActivityRepository
{
  constructor(
    txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    dispatcher: DomainEventDispatcher,
  ) {
    super(txHost, dispatcher);
  }

  /** The unique index on `name` is the backstop for the handlers' check. */
  async save(entity: MaintenanceActivity): Promise<void> {
    try {
      await super.save(entity);
    } catch (error) {
      if (isUniqueViolationOn(error, 'name')) {
        throw MaintenanceActivityNameTaken.withName(entity.name());
      }
      throw error;
    }
  }

  protected delegate(): ModelDelegate<MaintenanceActivityRecord> {
    return this.txHost.tx.maintenanceActivity;
  }

  protected toDomain(record: MaintenanceActivityRecord): MaintenanceActivity {
    return toDomain(record);
  }

  protected toPersistence(
    entity: MaintenanceActivity,
  ): MaintenanceActivityRecord {
    return { id: entity.id.asString(), name: entity.name().asString() };
  }

  async findByName(
    name: MaintenanceActivityName,
  ): Promise<MaintenanceActivity | null> {
    const record = await this.txHost.tx.maintenanceActivity.findUnique({
      where: { name: name.asString() },
    });
    return record ? toDomain(record) : null;
  }

  async list(): Promise<MaintenanceActivity[]> {
    const records = await this.txHost.tx.maintenanceActivity.findMany();
    return records.map((record) => toDomain(record));
  }
}
