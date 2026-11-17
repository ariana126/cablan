import { Equipment } from '@maintenance/domain/equipment.aggregate';
import { QcActivityRepository } from '@maintenance/domain/service/qc-activity.repository';
import { Injectable } from '@nestjs/common';

import { byPersianName } from './persian-order';
import {
  QcActivityStatusReadModel,
  QcEquipmentReadModel,
} from './qc-equipment.read-model';
import { QcExecutionReader } from './qc-execution-reader';

/**
 * Each piece of equipment's QC activities with their current names and
 * their last execution on it — the QC catalog and the last executions read
 * once per query, whatever the number of equipment. Shared by the QC folder
 * and the inspection view.
 */
@Injectable()
export class QcEquipmentStatuses {
  constructor(
    private readonly activityRepository: QcActivityRepository,
    private readonly executionReader: QcExecutionReader,
  ) {}

  /** One read model per piece of equipment, in the order given. */
  async of(equipment: readonly Equipment[]): Promise<QcEquipmentReadModel[]> {
    if (equipment.length === 0) {
      return [];
    }
    const activities = await this.activityRepository.list();
    const lastExecutions = await this.executionReader.lastPerformed(
      equipment.map((candidate) => candidate.id),
    );
    const namesById = new Map(
      activities.map((activity) => [
        activity.id.asString(),
        activity.name().asString(),
      ]),
    );
    const lastByPair = new Map(
      lastExecutions.map((last) => [
        `${last.equipmentId}:${last.activityId}`,
        last.performedAt,
      ]),
    );

    return equipment.map((candidate) => ({
      id: candidate.id.asString(),
      name: candidate.name().asString(),
      retired: candidate.isRetired(),
      // The equipment and the catalog are two reads, not one snapshot: an
      // activity unassigned and deleted between them is no longer assigned,
      // so it is left out rather than failing the whole read.
      activities: candidate
        .qcActivityIds()
        .flatMap((activityId): QcActivityStatusReadModel[] => {
          const activityName = namesById.get(activityId.asString());
          if (activityName === undefined) {
            return [];
          }
          const lastPerformedAt = lastByPair.get(
            `${candidate.id.asString()}:${activityId.asString()}`,
          );
          return [
            {
              activityId: activityId.asString(),
              activityName,
              lastPerformedAt: lastPerformedAt?.toISOString() ?? null,
            },
          ];
        })
        .toSorted((left, right) =>
          byPersianName(left.activityName, right.activityName),
        ),
    }));
  }
}
