import { DomainEventDispatcher } from '@framework/application';
import { EntityNotFound, Identity } from '@framework/domain';
import {
  ModelDelegate,
  PrismaEntityRepository,
  PrismaService,
} from '@framework/infrastructure';
import {
  EquipmentChangedConcurrently,
  EquipmentNameTaken,
} from '@maintenance/application/exceptions';
import { Equipment } from '@maintenance/domain/equipment.aggregate';
import { ActivityAlreadyInPmPlan } from '@maintenance/domain/exceptions/activity-already-in-pm-plan.exception';
import { QcActivityAlreadyAssigned } from '@maintenance/domain/exceptions/qc-activity-already-assigned.exception';
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
import { isForeignKeyViolation } from './foreign-key-violation';
import { isUniqueViolationOn } from './unique-violation';

const PLAN_ITEMS_INCLUDE = {
  planItems: { orderBy: { position: 'asc' } },
  serviceBreaks: { orderBy: { position: 'asc' } },
  qcAssignments: {
    select: { qcActivityId: true },
    orderBy: { assignedAt: 'asc' },
  },
} as const;

type EquipmentWithPlanItems = Prisma.EquipmentGetPayload<{
  include: typeof PLAN_ITEMS_INCLUDE;
}>;

function toRecord(record: EquipmentWithPlanItems): EquipmentRecord {
  return {
    id: record.id,
    name: record.name,
    serviceBreaks: record.serviceBreaks.map((serviceBreak) => ({
      position: serviceBreak.position,
      retiredAt: serviceBreak.retiredAt,
      reactivatedAt: serviceBreak.reactivatedAt,
    })),
    planItems: record.planItems.map((item) => ({
      id: item.id,
      position: item.position,
      activityId: item.activityId,
      activityName: item.activityName,
      schedule: item.schedule as unknown as PmScheduleSegmentRecord[],
      deactivatedAt: item.deactivatedAt,
    })),
    qcActivityIds: record.qcAssignments.map(
      (assignment) => assignment.qcActivityId,
    ),
  };
}

function scheduleJson(item: PmPlanItemRecord): Prisma.InputJsonValue {
  return item.schedule as unknown as Prisma.InputJsonValue;
}

/** What the repository last read or wrote of a piece of equipment's child rows. */
interface LoadedRows {
  readonly planItemIds: readonly string[];
  readonly qcActivityIds: readonly string[];
}

/**
 * What `PrismaEquipmentRepository` hands its delegate: the record, and — for
 * equipment loaded from storage, so only ever updated — the plan items and
 * QC assignments it had then. Only those no longer in it are deleted: a row
 * another request added meanwhile is never removed by a save that did not
 * know it.
 */
interface StoredEquipmentRecord extends EquipmentRecord {
  readonly loaded?: LoadedRows;
}

/**
 * `ModelDelegate<EquipmentRecord>` by hand, since the aggregate spans four
 * tables (`equipment`, `pm_plan_item`, `equipment_service_break`,
 * `qc_assignment`). It saves
 * the aggregate whole (issue #110): plan items no longer in it are deleted
 * first, then the rest are upserted one by one in plan order — a kept item
 * keeps its row and its id, which executions name, and only moves down in
 * `position`, so renumbering in ascending order never collides. Service
 * breaks are rewritten as the aggregate holds them. QC assignments (issue
 * #119) are diffed against those loaded: the removed ones deleted, the added
 * ones inserted, never the whole set rewritten. Built per call from
 * `txHost.tx`, so every write joins the transaction
 * `PrismaEntityRepository.save()` opened (ADR 0007).
 */
class EquipmentDelegate implements ModelDelegate<StoredEquipmentRecord> {
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
    create: StoredEquipmentRecord;
    update: Omit<StoredEquipmentRecord, 'id'>;
  }): Promise<StoredEquipmentRecord> {
    const { create } = args;
    await this.writeEquipmentRow(create);
    const kept = new Set(create.planItems.map((item) => item.id));
    const removed = (create.loaded?.planItemIds ?? []).filter(
      (id) => !kept.has(id),
    );
    if (removed.length > 0) {
      await this.db.pmPlanItem.deleteMany({
        where: { equipmentId: create.id, id: { in: removed } },
      });
    }
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
          deactivatedAt: item.deactivatedAt,
        },
        update: {
          position: item.position,
          schedule: scheduleJson(item),
          deactivatedAt: item.deactivatedAt,
        },
      });
    }
    await this.db.equipmentServiceBreak.deleteMany({
      where: { equipmentId: create.id },
    });
    if (create.serviceBreaks.length > 0) {
      await this.db.equipmentServiceBreak.createMany({
        data: create.serviceBreaks.map((serviceBreak) => ({
          equipmentId: create.id,
          ...serviceBreak,
        })),
      });
    }
    await this.writeQcAssignments(create);
    return create;
  }

  /**
   * Its plan items and service breaks go with it, by cascade; its QC
   * assignments are deleted first, their foreign key being RESTRICT. Its QC
   * records are the caller's to delete before (issue #119).
   */
  async delete(args: { where: { id: string } }): Promise<EquipmentRecord> {
    await this.db.qcAssignment.deleteMany({
      where: { equipmentId: args.where.id },
    });
    const record = await this.db.equipment.delete({
      where: args.where,
      include: PLAN_ITEMS_INCLUDE,
    });
    return toRecord(record);
  }

  /** The QC assignments removed since the load deleted, the added inserted. */
  private async writeQcAssignments(
    record: StoredEquipmentRecord,
  ): Promise<void> {
    const loaded = new Set(record.loaded?.qcActivityIds);
    const held = new Set(record.qcActivityIds);
    const removed = [...loaded].filter((id) => !held.has(id));
    const added = record.qcActivityIds.filter((id) => !loaded.has(id));
    if (removed.length > 0) {
      await this.db.qcAssignment.deleteMany({
        where: { equipmentId: record.id, qcActivityId: { in: removed } },
      });
    }
    if (added.length > 0) {
      await this.db.qcAssignment.createMany({
        data: added.map((qcActivityId) => ({
          equipmentId: record.id,
          qcActivityId,
        })),
      });
    }
  }

  /**
   * New equipment is created; equipment loaded from storage is only updated
   * (reviewer L1). An update that finds no row means another request deleted
   * it meanwhile — the update waited for that delete's commit — and is
   * refused, never turned into a create that would bring it back.
   */
  private async writeEquipmentRow(
    record: StoredEquipmentRecord,
  ): Promise<void> {
    if (record.loaded === undefined) {
      await this.db.equipment.create({
        data: { id: record.id, name: record.name },
      });
      return;
    }
    const { count } = await this.db.equipment.updateMany({
      where: { id: record.id },
      data: { name: record.name },
    });
    if (count === 0) {
      throw EntityNotFound.withId(Identity.fromString(record.id));
    }
  }
}

@Injectable()
export class PrismaEquipmentRepository
  extends PrismaEntityRepository<Equipment, StoredEquipmentRecord>
  implements EquipmentRepository
{
  /**
   * The equipment this repository loaded or saved, with the ids of its plan
   * items and QC activities as they were stored — only ever updated, never
   * re-created.
   */
  private readonly stored = new WeakMap<Equipment, LoadedRows>();

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
   *
   * Two items added at once to one plan both take the same `position`, and
   * Postgres checks a row's unique indexes in the order they were created:
   * `(equipment_id, position)` before the hand-added partial activity index.
   * So a position clash is reported even when both writers added the *same*
   * activity. `conflictOnPosition` tells the two races apart.
   */
  async save(entity: Equipment): Promise<void> {
    try {
      await super.save(entity);
      this.remember(entity);
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
      if (isUniqueViolationOn(error, 'equipment_id', 'position')) {
        throw await this.conflictOnPosition(entity);
      }
      if (isUniqueViolationOn(error, 'equipment_id', 'qc_activity_id')) {
        throw await this.qcActivityAssignedMeanwhile(entity);
      }
      throw error;
    }
  }

  /**
   * Why a plan item could not take its place: the other writer added the
   * same activity (`ActivityAlreadyInPmPlan`), or another one
   * (`EquipmentChangedConcurrently`). Read once the failed save has rolled
   * back and the other writer has committed — which the unique index waited
   * for. `save()` opens the outermost transaction on every path that adds an
   * item; were it ever nested, the aborted transaction would refuse the read,
   * and the answer falls back to the generic conflict.
   */
  private async conflictOnPosition(entity: Equipment): Promise<Error> {
    try {
      const stored = await this.txHost.tx.pmPlanItem.findMany({
        where: { equipmentId: entity.id.asString(), deactivatedAt: null },
        select: { id: true, activityId: true },
      });
      const duplicate = entity
        .activePlanItems()
        .find((item) =>
          stored.some(
            (row) =>
              row.activityId === item.activityId().asString() &&
              row.id !== item.id.asString(),
          ),
        );
      if (duplicate) {
        return ActivityAlreadyInPmPlan.of(
          entity.id.asString(),
          duplicate.activityId().asString(),
        );
      }
    } catch {
      // An aborted outer transaction: nothing can be read in it.
    }
    return EquipmentChangedConcurrently.withId(entity.id.asString());
  }

  /**
   * A QC record committed after the delete cascade listed the equipment's
   * records (issue #119) is still there when the equipment row goes: its
   * foreign key (RESTRICT) refuses. That is the equipment changed by another
   * request meanwhile — the delete rolls back whole, and a retry takes the
   * new record too.
   */
  async delete(entity: Equipment): Promise<void> {
    try {
      await super.delete(entity);
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw EquipmentChangedConcurrently.withId(entity.id.asString());
      }
      throw error;
    }
  }

  /**
   * Two requests assigning one QC activity at once (issue #119): the second
   * insert hits the unique key. Its newest assignment is the one refused,
   * named as the catalog has it now — read once the save rolled back, falling
   * back to the id were the transaction still open.
   */
  private async qcActivityAssignedMeanwhile(
    entity: Equipment,
  ): Promise<QcActivityAlreadyAssigned> {
    const activityId = entity.qcActivityIds().at(-1)?.asString() ?? '';
    let activityName = activityId;
    try {
      const activity = await this.txHost.tx.qcActivity.findUnique({
        where: { id: activityId },
        select: { name: true },
      });
      activityName = activity?.name ?? activityId;
    } catch {
      // An aborted outer transaction: nothing can be read in it.
    }
    return QcActivityAlreadyAssigned.of(
      { id: entity.id.asString(), name: entity.name().asString() },
      { id: activityId, name: activityName },
    );
  }

  protected delegate(): ModelDelegate<StoredEquipmentRecord> {
    return new EquipmentDelegate(this.txHost.tx);
  }

  protected toDomain(record: EquipmentRecord): Equipment {
    const equipment = EquipmentMapper.toDomain(record);
    this.remember(equipment);
    return equipment;
  }

  protected toPersistence(entity: Equipment): StoredEquipmentRecord {
    return {
      ...EquipmentMapper.toPersistence(entity),
      loaded: this.stored.get(entity),
    };
  }

  private remember(equipment: Equipment): void {
    this.stored.set(equipment, {
      planItemIds: equipment.planItems().map((item) => item.id.asString()),
      qcActivityIds: equipment.qcActivityIds().map((id) => id.asString()),
    });
  }

  async findByName(name: EquipmentName): Promise<Equipment | null> {
    const record = await this.txHost.tx.equipment.findUnique({
      where: { name: name.asString() },
      include: PLAN_ITEMS_INCLUDE,
    });
    return record ? this.toDomain(toRecord(record)) : null;
  }

  // `SELECT … FOR UPDATE` on the `equipment` rows, in id order so two
  // lockers never deadlock, then one fresh load. Every save of equipment
  // updates its row, so a concurrent save waits for this transaction; and
  // the load, made once locked (read committed), sees whatever committed
  // before. `withTransaction` joins the caller's unit of work.
  async loadLocked(ids: readonly Identity[]): Promise<Equipment[]> {
    if (ids.length === 0) return [];
    const values = ids.map((id) => id.asString());
    return this.txHost.withTransaction(async () => {
      await this.txHost.tx.$queryRaw`
        SELECT 1 FROM equipment
        WHERE id IN (${Prisma.join(values)})
        ORDER BY id
        FOR UPDATE`;
      const records = await this.txHost.tx.equipment.findMany({
        where: { id: { in: values } },
        include: PLAN_ITEMS_INCLUDE,
        orderBy: { id: 'asc' },
      });
      return records.map((record) => this.toDomain(toRecord(record)));
    });
  }

  async list(): Promise<Equipment[]> {
    const records = await this.txHost.tx.equipment.findMany({
      include: PLAN_ITEMS_INCLUDE,
    });
    return records.map((record) => this.toDomain(toRecord(record)));
  }
}
