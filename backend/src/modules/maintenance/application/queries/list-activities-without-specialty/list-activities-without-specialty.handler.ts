import { byPersianName } from '@maintenance/application/service/persian-order';
import { MaintenanceActivityRepository } from '@maintenance/domain/service/maintenance-activity.repository';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { ActivityWithoutSpecialtyReadModel } from './activity-without-specialty.read-model';
import { ListActivitiesWithoutSpecialtyQuery } from './list-activities-without-specialty.query';

/**
 * What the System Admin's one-time assignment must cover, by Persian name.
 * Nothing records that the assignment was done: once this is empty, it is.
 */
@QueryHandler(ListActivitiesWithoutSpecialtyQuery)
export class ListActivitiesWithoutSpecialtyHandler implements IQueryHandler<ListActivitiesWithoutSpecialtyQuery> {
  constructor(
    private readonly activityRepository: MaintenanceActivityRepository,
  ) {}

  async execute(): Promise<ActivityWithoutSpecialtyReadModel[]> {
    const activities = await this.activityRepository.list();
    return activities
      .filter((activity) => !activity.hasSpecialty())
      .map(
        (activity) =>
          new ActivityWithoutSpecialtyReadModel(
            activity.id.asString(),
            activity.name().asString(),
          ),
      )
      .toSorted((left, right) => byPersianName(left.name, right.name));
  }
}
