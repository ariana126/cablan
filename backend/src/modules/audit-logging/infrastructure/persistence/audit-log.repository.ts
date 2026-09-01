import {
  AuditAction,
  AuditLogChangeRecord,
  AuditLogFilters,
  AuditLogRepository,
  AuditLogSearchCriteria,
  AuditLogSearchResult,
  AuditRecordType,
  RecordAuditLogEntryInput,
} from '@audit-logging/application/service/audit-log.repository';
import { Identity } from '@framework/domain';
import { PrismaService } from '@framework/infrastructure';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

// This module's only Prisma-facing adapter: there is no aggregate/write
// model, so unlike every other module's `Prisma*Repository` this never maps
// to/from a domain entity — `record()`/`search()`/`findChangesByEntryId()`
// all deal in the same plain records `AuditLogRepository` itself declares.
@Injectable()
export class PrismaAuditLogRepository implements AuditLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: RecordAuditLogEntryInput): Promise<void> {
    await this.prisma.auditLogEntry.create({
      data: {
        occurredAt: entry.occurredAt,
        actorId: entry.actorId,
        actorName: entry.actorName,
        recordType: entry.recordType,
        recordId: entry.recordId,
        action: entry.action,
        changes:
          entry.changes.length === 0
            ? undefined
            : {
                create: entry.changes.map((change) => ({
                  field: change.field,
                  previousValue: change.previousValue,
                  newValue: change.newValue,
                })),
              },
      },
    });
  }

  async search(
    criteria: AuditLogSearchCriteria,
  ): Promise<AuditLogSearchResult> {
    const where = toWhereInput(criteria.filters);
    const skip = (criteria.page - 1) * criteria.pageSize;

    const [records, total] = await Promise.all([
      this.prisma.auditLogEntry.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip,
        take: criteria.pageSize,
        select: {
          id: true,
          occurredAt: true,
          actorName: true,
          recordType: true,
          recordId: true,
          action: true,
        },
      }),
      this.prisma.auditLogEntry.count({ where }),
    ]);

    return {
      items: records.map((record) => ({
        id: record.id,
        occurredAt: record.occurredAt,
        actorName: record.actorName,
        recordType: record.recordType as AuditRecordType,
        recordId: record.recordId,
        action: record.action as AuditAction,
      })),
      total,
    };
  }

  async findChangesByEntryId(
    id: Identity,
  ): Promise<AuditLogChangeRecord[] | null> {
    const record = await this.prisma.auditLogEntry.findUnique({
      where: { id: id.asString() },
      include: { changes: true },
    });
    if (!record) {
      return null;
    }

    return record.changes.map((change) => ({
      field: change.field,
      previousValue: change.previousValue,
      newValue: change.newValue,
    }));
  }
}

// A filter field left `undefined` on `AuditLogFilters` means unfiltered — the
// same convention `BomReportFilters`/`toWhereInput` use in `boms` (see
// `PrismaBomReportRepository`). `to` here is already the exclusive
// start-of-next-day instant `ListAuditLogHandler` computed; this function
// only ever compares plain instants.
function toWhereInput(
  filters: AuditLogFilters,
): Prisma.AuditLogEntryWhereInput {
  const where: Prisma.AuditLogEntryWhereInput = {};

  if (filters.actorName !== undefined) {
    where.actorName = filters.actorName;
  }
  if (filters.recordId !== undefined) {
    where.recordId = filters.recordId;
  }
  if (filters.from !== undefined || filters.to !== undefined) {
    where.occurredAt = {
      ...(filters.from === undefined ? {} : { gte: filters.from }),
      ...(filters.to === undefined ? {} : { lt: filters.to }),
    };
  }

  return where;
}
