import { DomainEvent, EntityNotFound, Identity } from '@framework/domain';
import { QcActivity } from '@maintenance/domain/qc-activity.aggregate';
import { QcActivityRepository } from '@maintenance/domain/service/qc-activity.repository';
import { QcActivityName } from '@maintenance/domain/value/qc-activity-name.vo';

// A hand-written fake, not a mock. `savedEvents` keeps what each save and
// delete released, so a spec can assert the fact a command recorded.
export class InMemoryQcActivityRepository extends QcActivityRepository {
  private readonly activitiesById = new Map<string, QcActivity>();
  readonly savedEvents: DomainEvent[] = [];

  find(id: Identity): Promise<QcActivity | null> {
    return Promise.resolve(this.activitiesById.get(id.asString()) ?? null);
  }

  async get(id: Identity): Promise<QcActivity> {
    const activity = await this.find(id);
    if (!activity) {
      throw EntityNotFound.withId(id);
    }
    return activity;
  }

  save(entity: QcActivity): Promise<void> {
    this.activitiesById.set(entity.id.asString(), entity);
    this.savedEvents.push(...entity.releaseEvents());
    return Promise.resolve();
  }

  delete(entity: QcActivity): Promise<void> {
    this.activitiesById.delete(entity.id.asString());
    this.savedEvents.push(...entity.releaseEvents());
    return Promise.resolve();
  }

  findByName(name: QcActivityName): Promise<QcActivity | null> {
    for (const activity of this.activitiesById.values()) {
      if (activity.name().equals(name)) return Promise.resolve(activity);
    }
    return Promise.resolve(null);
  }

  list(): Promise<QcActivity[]> {
    return Promise.resolve([...this.activitiesById.values()]);
  }

  seed(activity: QcActivity): QcActivity {
    this.activitiesById.set(activity.id.asString(), activity);
    activity.releaseEvents();
    return activity;
  }
}
