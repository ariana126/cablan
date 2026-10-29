import { DomainEventDispatcher } from '@framework/application';
import {
  ModelDelegate,
  PrismaEntityRepository,
  PrismaService,
} from '@framework/infrastructure';
import { EquipmentNameTaken } from '@maintenance/application/exceptions';
import { Equipment } from '@maintenance/domain/equipment.aggregate';
import { ActivityAlreadyInPmPlan } from '@maintenance/domain/exceptions/activity-already-in-pm-plan.exception';
import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { EquipmentName } from '@maintenance/domain/value/equipment-name.vo';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Prisma } from '@prisma/client';

import {
  EquipmentMapper,
  EquipmentRecord,
  PmPlanItemRecord,
  PmScheduleSegmentRecord,
} from './equipment.mapper';
import { isUniqueViolationOn } from './unique-violation';

const PLAN_ITEMS_INCLUDE = {
  planItems: { orderBy: { position: 'asc' } },
} as const;

type EquipmentWithPlanItems = Prisma.EquipmentGetPayload<{
  include: typeof PLAN_ITEMS_INCLUDE;
}>;

function toRecord(record: EquipmentWithPlanItems): EquipmentRecord {
  return {
    id: record.id,
    name: record.name,
    retiredAt: record.retiredAt,
    planItems: record.planItems.map((item) => ({
      id: item.id,
      position: item.position,
      activityId: item.activityId,
      activityName: item.activityName,
      schedule: item.schedule as unknown as PmScheduleSegmentRecord[],
      removedAt: item.removedAt,
    })),
  };
}

function scheduleJson(item: PmPlanItemRecord): Prisma.InputJsonValue {
  return item.schedule as unknown as Prisma.InputJsonValue;
}

/**
 * `ModelDelegate<EquipmentRecord>` by hand, since the aggregate spans two
 * tables (`equipment`, `pm_plan_item`). Plan items are upserted one by one —
 * never deleted and recreated — because a removed item keeps its row and its
 * id, which executions name. Built per call from `txHost.tx`, so every write
 * joins the transaction `PrismaEntityRepository.save()` opened (ADR 0007).
 */
class EquipmentDelegate implements ModelDelegate<EquipmentRecord> {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async findUnique(args: {
    where: { id: string };
  }): Promise<EquipmentRecord | null> {
    const record = await this.db.equipment.findUnique({
      where: args.where,
      include: PLAN_ITEMS_INCLUDE,
    });
    return record ? toRecord(record) : null;
  }

  async upsert(args: {
    where: { id: string };
    create: EquipmentRecord;
    update: Omit<EquipmentRecord, 'id'>;
  }): Promise<EquipmentRecord> {
    const { where, create } = args;
    await this.db.equipment.upsert({
      where,
      create: { id: create.id, name: create.name, retiredAt: create.retiredAt },
      update: { name: create.name, retiredAt: create.retiredAt },
    });
    // In plan order, one at a time: never concurrently on one transaction.
    for (const item of create.planItems) {
      await this.db.pmPlanItem.upsert({
        where: { id: item.id },
        create: {
          id: item.id,
          equipmentId: create.id,
          position: item.position,
          activityId: item.activityId,
          activityName: item.activityName,
          schedule: scheduleJson(item),
          removedAt: item.removedAt,
        },
        update: { schedule: scheduleJson(item), removedAt: item.removedAt },
      });
    }
    return create;
  }

  async delete(args: { where: { id: string } }): Promise<EquipmentRecord> {
    // Not on the port — equipment is retired, never deleted. The base class
    // requires the method; nothing calls it.
    const record = await this.db.equipment.delete({
      where: args.where,
      include: PLAN_ITEMS_INCLUDE,
    });
    return toRecord(record);
  }
}

@Injectable()
export class PrismaEquipmentRepository
  extends PrismaEntityRepository<Equipment, EquipmentRecord>
  implements EquipmentRepository
{
  constructor(
    txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    dispatcher: DomainEventDispatcher,
  ) {
    super(txHost, dispatcher);
  }

  /**
   * The handlers and the aggregate refuse a taken name and a second active
   * item for one activity first; the unique indexes are the backstop for two
   * writes that both passed those checks, surfacing as the same 409s.
   */
  async save(entity: Equipment): Promise<void> {
    try {
      await super.save(entity);
    } catch (error) {
      if (isUniqueViolationOn(error, 'name')) {
        throw EquipmentNameTaken.withName(entity.name());
      }
      if (isUniqueViolationOn(error, 'equipment_id', 'activity_id')) {
        const newest = entity.activePlanItems().at(-1);
        throw ActivityAlreadyInPmPlan.of(
          entity.id.asString(),
          newest?.activityId().asString() ?? '',
        );
      }
      throw error;
    }
  }

  protected delegate(): ModelDelegate<EquipmentRecord> {
    return new EquipmentDelegate(this.txHost.tx);
  }

  protected toDomain(record: EquipmentRecord): Equipment {
    return EquipmentMapper.toDomain(record);
  }

  protected toPersistence(entity: Equipment): EquipmentRecord {
    return EquipmentMapper.toPersistence(entity);
  }

  async findByName(name: EquipmentName): Promise<Equipment | null> {
    const record = await this.txHost.tx.equipment.findUnique({
      where: { name: name.asString() },
      include: PLAN_ITEMS_INCLUDE,
    });
    return record ? this.toDomain(toRecord(record)) : null;
  }

  async list(): Promise<Equipment[]> {
    const records = await this.txHost.tx.equipment.findMany({
      include: PLAN_ITEMS_INCLUDE,
    });
    return records.map((record) => this.toDomain(toRecord(record)));
  }
}
