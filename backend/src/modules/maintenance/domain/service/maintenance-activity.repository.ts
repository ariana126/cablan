import { EntityRepository } from '@framework/domain';

import { MaintenanceActivity } from '../maintenance-activity.aggregate';
import { MaintenanceActivityName } from '../value/maintenance-activity-name.vo';

export abstract class MaintenanceActivityRepository extends EntityRepository<MaintenanceActivity> {
  abstract findByName(
    name: MaintenanceActivityName,
  ): Promise<MaintenanceActivity | null>;

  /** The whole catalog, in no particular order. */
  abstract list(): Promise<MaintenanceActivity[]>;
}
