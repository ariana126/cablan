import { EntityNotFound, Identity } from '@framework/domain';
import { MaintenanceActivity } from '@maintenance/domain/maintenance-activity.aggregate';
import { MaintenanceActivityRepository } from '@maintenance/domain/service/maintenance-activity.repository';
import { MaintenanceActivityName } from '@maintenance/domain/value/maintenance-activity-name.vo';

export class InMemoryMaintenanceActivityRepository extends MaintenanceActivityRepository {
  private readonly activitiesById = new Map<string, MaintenanceActivity>();

  find(id: Identity): Promise<MaintenanceActivity | null> {
    return Promise.resolve(this.activitiesById.get(id.asString()) ?? null);
  }

  async get(id: Identity): Promise<MaintenanceActivity> {
    const activity = await this.find(id);
    if (!activity) {
      throw EntityNotFound.withId(id);
    }
    return activity;
  }

  save(entity: MaintenanceActivity): Promise<void> {
    this.activitiesById.set(entity.id.asString(), entity);
    entity.releaseEvents();
    return Promise.resolve();
  }

  findByName(
    name: MaintenanceActivityName,
  ): Promise<MaintenanceActivity | null> {
    for (const activity of this.activitiesById.values()) {
      if (activity.name().equals(name)) return Promise.resolve(activity);
    }
    return Promise.resolve(null);
  }

  list(): Promise<MaintenanceActivity[]> {
    return Promise.resolve([...this.activitiesById.values()]);
  }

  seed(activity: MaintenanceActivity): MaintenanceActivity {
    this.activitiesById.set(activity.id.asString(), activity);
    activity.releaseEvents();
    return activity;
  }
}
