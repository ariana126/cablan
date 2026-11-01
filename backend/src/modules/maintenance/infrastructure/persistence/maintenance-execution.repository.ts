import { DomainEventDispatcher } from '@framework/application';
import { Identity } from '@framework/domain';
import {
  ModelDelegate,
  PrismaEntityRepository,
  PrismaService,
} from '@framework/infrastructure';
import { PmOccurrenceAlreadyRecorded } from '@maintenance/domain/exceptions/pm-occurrence-already-recorded.exception';
import {
  MaintenanceExecution,
  Performer,
} from '@maintenance/domain/maintenance-execution.aggregate';
import {
  MaintenanceExecutionRepository,
  PlanItemDueDateRange,
} from '@maintenance/domain/service/maintenance-execution.repository';
import { CalendarDate } from '@maintenance/domain/value/calendar-date.vo';
import { CalendarDateRange } from '@maintenance/domain/value/calendar-date-range.vo';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';

import { isUniqueViolationOn } from './unique-violation';

export interface MaintenanceExecutionRecord {
  id: string;
  equipmentId: string;
  equipmentName: string;
  planItemId: string;
  activityId: string;
  activityName: string;
  /** A `date` column: midnight UTC of the calendar date, as Prisma reads it. */
  dueDate: Date;
  performedAt: Date;
  performedById: string;
  performedByName: string;
  notes: string | null;
}

function toDomain(record: MaintenanceExecutionRecord): MaintenanceExecution {
  return MaintenanceExecution.fromPersistence(Identity.fromString(record.id), {
    equipmentId: Identity.fromString(record.equipmentId),
    equipmentName: record.equipmentName,
    planItemId: Identity.fromString(record.planItemId),
    activityId: Identity.fromString(record.activityId),
    activityName: record.activityName,
    dueDate: CalendarDate.fromString(record.dueDate.toISOString().slice(0, 10)),
    performedAt: record.performedAt,
    performedById: Identity.fromString(record.performedById),
    performedByName: record.performedByName,
    notes: record.notes,
  });
}

function toPersistence(
  entity: MaintenanceExecution,
): MaintenanceExecutionRecord {
  return {
    id: entity.id.asString(),
    equipmentId: entity.equipmentId().asString(),
    equipmentName: entity.equipmentName(),
    planItemId: entity.planItemId().asString(),
    activityId: entity.activityId().asString(),
    activityName: entity.activityName(),
    dueDate: new Date(`${entity.dueDate().asString()}T00:00:00.000Z`),
    performedAt: entity.performedAt(),
    performedById: entity.performedById().asString(),
    performedByName: entity.performedByName(),
    notes: entity.notes(),
  };
}

@Injectable()
export class PrismaMaintenanceExecutionRepository
  extends PrismaEntityRepository<
    MaintenanceExecution,
    MaintenanceExecutionRecord
  >
  implements MaintenanceExecutionRepository
{
  constructor(
    txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    dispatcher: DomainEventDispatcher,
  ) {
    super(txHost, dispatcher);
  }

  /**
   * Two executions recorded at once can both target the same occurrence;
   * the unique key on `(plan_item_id, due_date)` refuses the second, which
   * surfaces as a 409 rather than a raw Prisma error.
   */
  async save(entity: MaintenanceExecution): Promise<void> {
    try {
      await super.save(entity);
    } catch (error) {
      if (isUniqueViolationOn(error, 'plan_item_id', 'due_date')) {
        throw PmOccurrenceAlreadyRecorded.of(
          entity.planItemId().asString(),
          entity.dueDate().asString(),
        );
      }
      throw error;
    }
  }

  protected delegate(): ModelDelegate<MaintenanceExecutionRecord> {
    return this.txHost.tx.maintenanceExecution;
  }

  protected toDomain(record: MaintenanceExecutionRecord): MaintenanceExecution {
    return toDomain(record);
  }

  protected toPersistence(
    entity: MaintenanceExecution,
  ): MaintenanceExecutionRecord {
    return toPersistence(entity);
  }

  async forPlanItem(planItemId: Identity): Promise<MaintenanceExecution[]> {
    const records = await this.txHost.tx.maintenanceExecution.findMany({
      where: { planItemId: planItemId.asString() },
    });
    return records.map((record) => toDomain(record));
  }

  async forEquipment(equipmentId: Identity): Promise<MaintenanceExecution[]> {
    return this.forEquipments([equipmentId]);
  }

  async forEquipments(
    equipmentIds: readonly Identity[],
  ): Promise<MaintenanceExecution[]> {
    const records = await this.txHost.tx.maintenanceExecution.findMany({
      where: { equipmentId: { in: equipmentIds.map((id) => id.asString()) } },
    });
    return records.map((record) => toDomain(record));
  }

  async dueIn(
    planItemIds: readonly Identity[],
    range: CalendarDateRange,
  ): Promise<MaintenanceExecution[]> {
    if (planItemIds.length === 0) {
      return [];
    }
    const records = await this.txHost.tx.maintenanceExecution.findMany({
      where: {
        planItemId: { in: planItemIds.map((id) => id.asString()) },
        dueDate: dueDateWithin(range),
      },
    });
    return records.map((record) => toDomain(record));
  }

  async dueOrPerformedIn(
    planItemIds: readonly Identity[],
    range: CalendarDateRange,
  ): Promise<MaintenanceExecution[]> {
    if (planItemIds.length === 0) {
      return [];
    }
    const records = await this.txHost.tx.maintenanceExecution.findMany({
      where: {
        planItemId: { in: planItemIds.map((id) => id.asString()) },
        OR: [
          { dueDate: dueDateWithin(range) },
          {
            performedAt: {
              gte: range.from.instantsInTehran().from,
              lt: range.to.instantsInTehran().until,
            },
          },
        ],
      },
    });
    return records.map((record) => toDomain(record));
  }

  async dueWithinOwnRanges(
    ranges: readonly PlanItemDueDateRange[],
  ): Promise<MaintenanceExecution[]> {
    if (ranges.length === 0) {
      return [];
    }
    const records = await this.txHost.tx.maintenanceExecution.findMany({
      where: {
        OR: ranges.map(({ planItemId, range }) => ({
          planItemId: planItemId.asString(),
          dueDate: dueDateWithin(range),
        })),
      },
    });
    return records.map((record) => toDomain(record));
  }

  /**
   * One row per performer, from their latest execution — `DISTINCT ON`, so
   * the history itself never leaves the database.
   */
  async performers(): Promise<Performer[]> {
    const rows = await this.txHost.tx.$queryRaw<
      { performed_by_id: string; performed_by_name: string }[]
    >`
      SELECT DISTINCT ON (performed_by_id) performed_by_id, performed_by_name
      FROM maintenance_execution
      ORDER BY performed_by_id, performed_at DESC
    `;
    return rows.map((row) => ({
      id: Identity.fromString(row.performed_by_id),
      name: row.performed_by_name,
    }));
  }
}

/** A `date` column's bounds: midnight UTC of each calendar date, inclusive. */
function dueDateWithin(range: CalendarDateRange): { gte: Date; lte: Date } {
  return {
    gte: new Date(`${range.from.asString()}T00:00:00.000Z`),
    lte: new Date(`${range.to.asString()}T00:00:00.000Z`),
  };
}
