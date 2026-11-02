import {
  DependentRecord,
  DependentsProbe,
  RecordReference,
} from '@framework/application';
import { PrismaService } from '@framework/infrastructure';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';

/**
 * `maintenance`'s answer to "which of my records reference this one?" (issue
 * #94): a PM plan item references its equipment and its activity, active and
 * deactivated items alike. Plan items are never deleted and every execution
 * hangs off one, so they cover the execution history too. The dependent is
 * the PM plan of a piece of equipment, named by the equipment — for an
 * Equipment subject, the equipment itself. Found by `RecordDependenciesModule`
 * because it extends `DependentsProbe`. On `txHost.tx`, like every read on the
 * write path.
 */
@Injectable()
export class PrismaMaintenanceDependentsProbe extends DependentsProbe {
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
      case 'Equipment': {
        return this.equipmentWhosePlanHolds({ equipmentId: reference.id });
      }
      case 'MaintenanceActivity': {
        return this.equipmentWhosePlanHolds({ activityId: reference.id });
      }
      default: {
        return [];
      }
    }
  }

  private async equipmentWhosePlanHolds(planItem: {
    equipmentId?: string;
    activityId?: string;
  }): Promise<DependentRecord[]> {
    const equipment = await this.txHost.tx.equipment.findMany({
      where: { planItems: { some: planItem } },
      select: { name: true },
    });
    return equipment.map(({ name }) => ({ kind: 'equipment-pm-plan', name }));
  }
}
