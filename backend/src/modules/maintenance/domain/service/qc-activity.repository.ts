import { EntityRepository } from '@framework/domain';

import { QcActivity } from '../qc-activity.aggregate';
import { QcActivityName } from '../value/qc-activity-name.vo';

/**
 * The QC activity catalog (issue #119). An implementation should also refuse
 * a second activity of one name (a unique key), the backstop for two
 * definitions or renames that both passed the handlers' check.
 */
export abstract class QcActivityRepository extends EntityRepository<QcActivity> {
  abstract findByName(name: QcActivityName): Promise<QcActivity | null>;

  /** Removes it, dispatching its released events. */
  abstract delete(activity: QcActivity): Promise<void>;

  /** The whole catalog, in no particular order. */
  abstract list(): Promise<QcActivity[]>;
}
