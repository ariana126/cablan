import { EntityRepository, Identity } from '@framework/domain';

import { QcExecution } from '../qc-execution.aggregate';

/** The QC records (issue #119), the write side; the reads go through `QcExecutionReader`. */
export abstract class QcExecutionRepository extends EntityRepository<QcExecution> {
  /** Removes one record, dispatching its released events. */
  abstract delete(execution: QcExecution): Promise<void>;

  /** Every record made on one piece of equipment, in no particular order. */
  abstract ofEquipment(equipmentId: Identity): Promise<QcExecution[]>;
}
