import {
  CorrectionPropagator,
  RecordCorrection,
  RecordReference,
} from '@framework/application';
import { PrismaService } from '@framework/infrastructure';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';

/**
 * `maintenance`'s snapshots of a corrected name (issue #110): an execution's
 * `equipment_name` and `activity_name`, and a plan item's `activity_name`.
 * Rewritten directly, on `txHost.tx`, in the correction's transaction — no
 * aggregate, no event, nothing else of the rows touched. Found by
 * `RecordDependenciesModule` because it extends `CorrectionPropagator`.
 */
@Injectable()
export class PrismaMaintenanceCorrectionPropagator extends CorrectionPropagator {
  constructor(
    private readonly txHost: TransactionHost<
      TransactionalAdapterPrisma<PrismaService>
    >,
  ) {
    super();
  }

  async propagate(
    reference: RecordReference,
    { name }: RecordCorrection,
  ): Promise<void> {
    if (name === undefined) {
      return;
    }
    const db = this.txHost.tx;
    switch (reference.type) {
      case 'Equipment': {
        await db.maintenanceExecution.updateMany({
          where: { equipmentId: reference.id },
          data: { equipmentName: name },
        });
        return;
      }
      case 'MaintenanceActivity': {
        await db.pmPlanItem.updateMany({
          where: { activityId: reference.id },
          data: { activityName: name },
        });
        await db.maintenanceExecution.updateMany({
          where: { activityId: reference.id },
          data: { activityName: name },
        });
        return;
      }
      default: {
        return;
      }
    }
  }
}
