import { byPersianName } from '@maintenance/application/service/persian-order';
import { QcExecutionFilter } from '@maintenance/application/service/qc-execution-filter';
import {
  QcExecutionReader,
  QcExecutionRow,
} from '@maintenance/application/service/qc-execution-reader';
import { wholeMinutesBetween } from '@maintenance/domain/value/qc-interval';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { GetQcExecutionHistoryQuery } from './get-qc-execution-history.query';
import {
  QcExecutionCountReadModel,
  QcExecutionHistoryReadModel,
  QcExecutionReadModel,
} from './qc-execution-history.read-model';

/**
 * The records newest first, each with its interval since the previous record
 * of the same activity on the same equipment — measured over every record,
 * so no filter changes it —, and the count of each pair among the records
 * the filters admit.
 */
@QueryHandler(GetQcExecutionHistoryQuery)
export class GetQcExecutionHistoryHandler implements IQueryHandler<GetQcExecutionHistoryQuery> {
  constructor(private readonly reader: QcExecutionReader) {}

  async execute(
    query: GetQcExecutionHistoryQuery,
  ): Promise<QcExecutionHistoryReadModel> {
    const filter = QcExecutionFilter.of(query.criteria);
    const rows = await this.reader.matching(filter);

    return {
      executions: rows.toReversed().map((row) => readModelOf(row)),
      counts: countsOf(rows),
    };
  }
}

function readModelOf(row: QcExecutionRow): QcExecutionReadModel {
  return {
    id: row.id,
    equipmentId: row.equipmentId,
    equipmentName: row.equipmentName,
    activityId: row.activityId,
    activityName: row.activityName,
    performedById: row.performedById,
    performedByName: row.performedByName,
    performedAt: row.performedAt.toISOString(),
    trackingNumber: row.trackingNumber,
    notes: row.notes,
    previousPerformedAt: row.previousPerformedAt?.toISOString() ?? null,
    intervalMinutes: row.previousPerformedAt
      ? wholeMinutesBetween(row.previousPerformedAt, row.performedAt)
      : null,
  };
}

function countsOf(
  rows: readonly QcExecutionRow[],
): QcExecutionCountReadModel[] {
  const byPair = new Map<string, QcExecutionCountReadModel>();
  for (const row of rows) {
    const key = `${row.equipmentId}:${row.activityId}`;
    const counted = byPair.get(key);
    byPair.set(key, {
      equipmentId: row.equipmentId,
      equipmentName: row.equipmentName,
      activityId: row.activityId,
      activityName: row.activityName,
      count: (counted?.count ?? 0) + 1,
    });
  }
  return [...byPair.values()].toSorted(
    (left, right) =>
      byPersianName(left.equipmentName, right.equipmentName) ||
      byPersianName(left.activityName, right.activityName),
  );
}
