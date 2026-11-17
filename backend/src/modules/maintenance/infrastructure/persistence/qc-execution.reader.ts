import { Identity } from '@framework/domain';
import { PrismaService } from '@framework/infrastructure';
import { QcExecutionFilter } from '@maintenance/application/service/qc-execution-filter';
import {
  LastQcExecution,
  QcExecutionReader,
  QcExecutionRow,
  QcPerformer,
} from '@maintenance/application/service/qc-execution-reader';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

interface QcExecutionRowRecord {
  id: string;
  equipment_id: string;
  equipment_name: string;
  qc_activity_id: string;
  activity_name: string;
  performed_by_id: string;
  performed_by_name: string;
  performed_at: Date;
  tracking_number: string;
  notes: string | null;
  previous_performed_at: Date | null;
}

/**
 * The QC records' read side (issue #119), on `PrismaService` since no read
 * runs inside a write. Every row joins the equipment's and the activity's
 * current names. "Previous" and "last" order a pair's records by
 * `(performed_at, sequence)` — `sequence`, the insertion order, breaks a tie
 * between records made at one instant.
 */
@Injectable()
export class PrismaQcExecutionReader extends QcExecutionReader {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  /**
   * The previous record comes from a window over **every** record of the
   * pair, computed before the other filters apply: only the equipment and
   * the activity — the window's own partition — narrow it beforehand, which
   * leaves each pair's window whole.
   */
  async matching(filter: QcExecutionFilter): Promise<QcExecutionRow[]> {
    const pairConditions = [
      ...(filter.equipmentId
        ? [Prisma.sql`e.equipment_id = ${filter.equipmentId.asString()}`]
        : []),
      ...(filter.activityId
        ? [Prisma.sql`e.qc_activity_id = ${filter.activityId.asString()}`]
        : []),
    ];
    const rowConditions = [
      ...(filter.from ? [Prisma.sql`o.performed_at >= ${filter.from}`] : []),
      ...(filter.to ? [Prisma.sql`o.performed_at <= ${filter.to}`] : []),
      ...(filter.performedById
        ? [Prisma.sql`o.performed_by_id = ${filter.performedById.asString()}`]
        : []),
      ...(filter.trackingNumber
        ? [
            Prisma.sql`strpos(lower(o.tracking_number), lower(${filter.trackingNumber})) > 0`,
          ]
        : []),
    ];

    const rows = await this.prisma.$queryRaw<QcExecutionRowRecord[]>`
      WITH ordered AS (
        SELECT
          e.*,
          lag(e.performed_at) OVER (
            PARTITION BY e.equipment_id, e.qc_activity_id
            ORDER BY e.performed_at, e.sequence
          ) AS previous_performed_at
        FROM qc_execution e
        ${whereAll(pairConditions)}
      )
      SELECT
        o.id,
        o.equipment_id,
        eq.name AS equipment_name,
        o.qc_activity_id,
        a.name AS activity_name,
        o.performed_by_id,
        o.performed_by_name,
        o.performed_at,
        o.tracking_number,
        o.notes,
        o.previous_performed_at
      FROM ordered o
      JOIN equipment eq ON eq.id = o.equipment_id
      JOIN qc_activity a ON a.id = o.qc_activity_id
      ${whereAll(rowConditions)}
      ORDER BY o.performed_at, o.sequence
    `;

    return rows.map((row) => ({
      id: row.id,
      equipmentId: row.equipment_id,
      equipmentName: row.equipment_name,
      activityId: row.qc_activity_id,
      activityName: row.activity_name,
      performedById: row.performed_by_id,
      performedByName: row.performed_by_name,
      performedAt: row.performed_at,
      trackingNumber: row.tracking_number,
      notes: row.notes,
      previousPerformedAt: row.previous_performed_at,
    }));
  }

  async lastPerformed(
    equipmentIds: readonly Identity[],
  ): Promise<LastQcExecution[]> {
    if (equipmentIds.length === 0) {
      return [];
    }
    const rows = await this.prisma.$queryRaw<
      { equipment_id: string; qc_activity_id: string; performed_at: Date }[]
    >`
      SELECT DISTINCT ON (equipment_id, qc_activity_id)
        equipment_id, qc_activity_id, performed_at
      FROM qc_execution
      WHERE equipment_id IN (${Prisma.join(equipmentIds.map((id) => id.asString()))})
      ORDER BY equipment_id, qc_activity_id, performed_at DESC, sequence DESC
    `;
    return rows.map((row) => ({
      equipmentId: row.equipment_id,
      activityId: row.qc_activity_id,
      performedAt: row.performed_at,
    }));
  }

  /** Once each, named as in their latest record. */
  async performers(): Promise<QcPerformer[]> {
    const rows = await this.prisma.$queryRaw<
      { performed_by_id: string; performed_by_name: string }[]
    >`
      SELECT DISTINCT ON (performed_by_id) performed_by_id, performed_by_name
      FROM qc_execution
      ORDER BY performed_by_id, performed_at DESC, sequence DESC
    `;
    return rows.map((row) => ({
      id: row.performed_by_id,
      name: row.performed_by_name,
    }));
  }
}

function whereAll(conditions: readonly Prisma.Sql[]): Prisma.Sql {
  return conditions.length === 0
    ? Prisma.empty
    : Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
}
