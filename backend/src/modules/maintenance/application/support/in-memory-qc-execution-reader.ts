import { Identity } from '@framework/domain';
import { QcExecutionFilter } from '@maintenance/application/service/qc-execution-filter';
import {
  LastQcExecution,
  QcExecutionReader,
  QcExecutionRow,
  QcPerformer,
} from '@maintenance/application/service/qc-execution-reader';
import { QcExecution } from '@maintenance/domain/qc-execution.aggregate';

import { InMemoryEquipmentRepository } from './in-memory-equipment-repository';
import { InMemoryQcActivityRepository } from './in-memory-qc-activity-repository';
import { InMemoryQcExecutionRepository } from './in-memory-qc-execution-repository';

// The read side over the in-memory write repositories, so a query spec
// arranges records once and reads the equipment's and activities' current
// names, as the Prisma reader joins them. Records made at one instant
// follow the order they were saved.
export class InMemoryQcExecutionReader extends QcExecutionReader {
  constructor(
    private readonly executions: InMemoryQcExecutionRepository,
    private readonly equipment: InMemoryEquipmentRepository,
    private readonly activities: InMemoryQcActivityRepository,
  ) {
    super();
  }

  async matching(filter: QcExecutionFilter): Promise<QcExecutionRow[]> {
    const chronological = this.chronological();
    const rows: QcExecutionRow[] = [];
    for (const [index, execution] of chronological.entries()) {
      if (!InMemoryQcExecutionReader.admits(filter, execution)) continue;
      const previous = chronological
        .slice(0, index)
        .findLast((earlier) =>
          InMemoryQcExecutionReader.samePair(earlier, execution),
        );
      rows.push(await this.rowOf(execution, previous ?? null));
    }
    return rows;
  }

  lastPerformed(equipmentIds: readonly Identity[]): Promise<LastQcExecution[]> {
    const latest = new Map<string, LastQcExecution>();
    for (const execution of this.chronological()) {
      if (!equipmentIds.some((id) => id.equals(execution.equipmentId()))) {
        continue;
      }
      const last = {
        equipmentId: execution.equipmentId().asString(),
        activityId: execution.activityId().asString(),
        performedAt: execution.performedAt(),
      };
      latest.set(`${last.equipmentId}:${last.activityId}`, last);
    }
    return Promise.resolve([...latest.values()]);
  }

  performers(): Promise<QcPerformer[]> {
    const latest = new Map<string, QcPerformer>();
    for (const execution of this.chronological()) {
      latest.set(execution.performedById().asString(), {
        id: execution.performedById().asString(),
        name: execution.performedByName(),
      });
    }
    return Promise.resolve([...latest.values()]);
  }

  private chronological(): QcExecution[] {
    return this.executions
      .all()
      .toSorted(
        (left, right) =>
          left.performedAt().getTime() - right.performedAt().getTime(),
      );
  }

  private async rowOf(
    execution: QcExecution,
    previous: QcExecution | null,
  ): Promise<QcExecutionRow> {
    const equipment = await this.equipment.get(execution.equipmentId());
    const activity = await this.activities.get(execution.activityId());
    return {
      id: execution.id.asString(),
      equipmentId: equipment.id.asString(),
      equipmentName: equipment.name().asString(),
      activityId: activity.id.asString(),
      activityName: activity.name().asString(),
      performedById: execution.performedById().asString(),
      performedByName: execution.performedByName(),
      performedAt: execution.performedAt(),
      trackingNumber: execution.trackingNumber().asString(),
      notes: execution.notes(),
      previousPerformedAt: previous?.performedAt() ?? null,
    };
  }

  private static samePair(left: QcExecution, right: QcExecution): boolean {
    return (
      left.equipmentId().equals(right.equipmentId()) &&
      left.activityId().equals(right.activityId())
    );
  }

  private static admits(
    filter: QcExecutionFilter,
    execution: QcExecution,
  ): boolean {
    const performedAt = execution.performedAt();
    return (
      (!filter.from || performedAt >= filter.from) &&
      (!filter.to || performedAt <= filter.to) &&
      (!filter.equipmentId ||
        filter.equipmentId.equals(execution.equipmentId())) &&
      (!filter.activityId ||
        filter.activityId.equals(execution.activityId())) &&
      (!filter.performedById ||
        filter.performedById.equals(execution.performedById())) &&
      (!filter.trackingNumber ||
        execution
          .trackingNumber()
          .asString()
          .toLowerCase()
          .includes(filter.trackingNumber.toLowerCase()))
    );
  }
}
