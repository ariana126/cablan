import {
  DependentKind,
  DependentRecord,
  DependentsProbe,
  RecordReference,
} from '@framework/application';
import { PrismaService } from '@framework/infrastructure';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';

/**
 * Production QC's answer to "which of my records reference this one?"
 * (issue #119). A QC assignment references its equipment and its activity,
 * named by the other side; a QC record references both too, counted but not
 * named (`name: null`) — a record outlives its assignment, so an activity
 * unassigned but recorded stays locked. Found by `RecordDependenciesModule`
 * because it extends `DependentsProbe`; on `txHost.tx`, like every read on
 * the write path.
 */
@Injectable()
export class PrismaQcDependentsProbe extends DependentsProbe {
  constructor(
    private readonly txHost: TransactionHost<
      TransactionalAdapterPrisma<PrismaService>
    >,
  ) {
    super();
  }

  async dependentsOf(
    reference: RecordReference,
  ): Promise<readonly DependentRecord[]> {
    switch (reference.type) {
      case 'qc-activity': {
        return this.ofActivity(reference.id);
      }
      case 'Equipment': {
        return this.ofEquipment(reference.id);
      }
      default: {
        return [];
      }
    }
  }

  private async ofActivity(activityId: string): Promise<DependentRecord[]> {
    const equipment = await this.txHost.tx.equipment.findMany({
      where: { qcAssignments: { some: { qcActivityId: activityId } } },
      select: { name: true },
    });
    const records = await this.txHost.tx.qcExecution.count({
      where: { qcActivityId: activityId },
    });
    return [
      ...equipment.map(({ name }) => ({
        kind: 'qc-assigned-equipment' as const,
        name,
      })),
      ...unnamed('qc-activity-execution', records),
    ];
  }

  private async ofEquipment(equipmentId: string): Promise<DependentRecord[]> {
    const activities = await this.txHost.tx.qcActivity.findMany({
      where: { assignments: { some: { equipmentId } } },
      select: { name: true },
    });
    const records = await this.txHost.tx.qcExecution.count({
      where: { equipmentId },
    });
    return [
      ...activities.map(({ name }) => ({
        kind: 'qc-assigned-activity' as const,
        name,
      })),
      ...unnamed('qc-equipment-execution', records),
    ];
  }
}

function unnamed(kind: DependentKind, count: number): DependentRecord[] {
  return Array.from({ length: count }, () => ({ kind, name: null }));
}
