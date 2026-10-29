import { byPersianName } from '@maintenance/application/service/persian-order';
import { MaintenanceActivityRepository } from '@maintenance/domain/service/maintenance-activity.repository';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { ListMaintenanceActivitiesQuery } from './list-maintenance-activities.query';
import { MaintenanceActivityReadModel } from './maintenance-activity.read-model';

@QueryHandler(ListMaintenanceActivitiesQuery)
export class ListMaintenanceActivitiesHandler implements IQueryHandler<ListMaintenanceActivitiesQuery> {
  constructor(
    private readonly activityRepository: MaintenanceActivityRepository,
  ) {}

  async execute(): Promise<MaintenanceActivityReadModel[]> {
    const activities = await this.activityRepository.list();
    return activities
      .map(
        (activity) =>
          new MaintenanceActivityReadModel(
            activity.id.asString(),
            activity.name().asString(),
          ),
      )
      .toSorted((left, right) => byPersianName(left.name, right.name));
  }
}
