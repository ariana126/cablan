import { PrismaService } from '@framework/infrastructure';
import {
  EquipmentQcAssignmentCount,
  QcActivityAssignmentCount,
  QcAssignmentReader,
} from '@maintenance/application/service/qc-assignment-reader';
import { Injectable } from '@nestjs/common';

/**
 * The QC lists' counts (issue #119), each in one query with the counts
 * grouped by the database, on `PrismaService` like every read-side
 * repository. Equipment is retired while it has an open service break —
 * only its last one can be open.
 */
@Injectable()
export class PrismaQcAssignmentReader extends QcAssignmentReader {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async activities(): Promise<QcActivityAssignmentCount[]> {
    const activities = await this.prisma.qcActivity.findMany({
      select: {
        id: true,
        name: true,
        _count: { select: { assignments: true } },
      },
    });
    return activities.map((activity) => ({
      id: activity.id,
      name: activity.name,
      assignedEquipmentCount: activity._count.assignments,
    }));
  }

  async equipment(): Promise<EquipmentQcAssignmentCount[]> {
    const equipment = await this.prisma.equipment.findMany({
      select: {
        id: true,
        name: true,
        serviceBreaks: {
          where: { reactivatedAt: null },
          select: { position: true },
        },
        _count: { select: { qcAssignments: true } },
      },
    });
    return equipment.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      retired: candidate.serviceBreaks.length > 0,
      assignedActivityCount: candidate._count.qcAssignments,
    }));
  }
}
