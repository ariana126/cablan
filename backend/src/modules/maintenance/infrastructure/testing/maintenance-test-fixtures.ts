import { Identity } from '@framework/domain';
import { MaintenanceActivity } from '@maintenance/domain/maintenance-activity.aggregate';
import { MaintenanceActivityRepository } from '@maintenance/domain/service/maintenance-activity.repository';
import { MaintenanceActivityName } from '@maintenance/domain/value/maintenance-activity-name.vo';
import { Injectable } from '@nestjs/common';

/**
 * State no client can reach any more, set up for an external test runner.
 * Mounted only at `NODE_ENV=test` (`MaintenanceTestingModule`).
 */
@Injectable()
export class MaintenanceTestFixtures {
  constructor(
    private readonly activityRepository: MaintenanceActivityRepository,
  ) {}

  /**
   * An activity as one registered before specialties existed was stored:
   * without a specialty. Rehydrated rather than registered, so it records no
   * event and writes no audit entry; a taken name is still the 409.
   */
  async activityWithoutSpecialty(
    name: MaintenanceActivityName,
  ): Promise<Identity> {
    const activity = MaintenanceActivity.fromPersistence(
      Identity.new(),
      name,
      null,
    );
    await this.activityRepository.save(activity);
    return activity.id;
  }
}
