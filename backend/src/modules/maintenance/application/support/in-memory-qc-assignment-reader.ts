import {
  EquipmentQcAssignmentCount,
  QcActivityAssignmentCount,
  QcAssignmentReader,
} from '@maintenance/application/service/qc-assignment-reader';

import { InMemoryEquipmentRepository } from './in-memory-equipment-repository';
import { InMemoryQcActivityRepository } from './in-memory-qc-activity-repository';

// Counts over the in-memory write repositories, as the Prisma reader groups
// the assignment rows.
export class InMemoryQcAssignmentReader extends QcAssignmentReader {
  constructor(
    private readonly equipmentRepository: InMemoryEquipmentRepository,
    private readonly activityRepository: InMemoryQcActivityRepository,
  ) {
    super();
  }

  async activities(): Promise<QcActivityAssignmentCount[]> {
    const equipment = await this.equipmentRepository.list();
    const activities = await this.activityRepository.list();
    return activities.map((activity) => ({
      id: activity.id.asString(),
      name: activity.name().asString(),
      assignedEquipmentCount: equipment.filter((candidate) =>
        candidate.isQcActivityAssigned(activity.id),
      ).length,
    }));
  }

  async equipment(): Promise<EquipmentQcAssignmentCount[]> {
    const equipment = await this.equipmentRepository.list();
    return equipment.map((candidate) => ({
      id: candidate.id.asString(),
      name: candidate.name().asString(),
      retired: candidate.isRetired(),
      assignedActivityCount: candidate.qcActivityIds().length,
    }));
  }
}
