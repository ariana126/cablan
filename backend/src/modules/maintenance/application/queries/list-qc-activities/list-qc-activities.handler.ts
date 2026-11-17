import { byPersianName } from '@maintenance/application/service/persian-order';
import { QcAssignmentReader } from '@maintenance/application/service/qc-assignment-reader';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { ListQcActivitiesQuery } from './list-qc-activities.query';
import { QcActivityReadModel } from './qc-activity.read-model';

@QueryHandler(ListQcActivitiesQuery)
export class ListQcActivitiesHandler implements IQueryHandler<ListQcActivitiesQuery> {
  constructor(private readonly reader: QcAssignmentReader) {}

  async execute(): Promise<QcActivityReadModel[]> {
    const activities = await this.reader.activities();
    return activities
      .map(
        (activity) =>
          new QcActivityReadModel(
            activity.id,
            activity.name,
            activity.assignedEquipmentCount,
          ),
      )
      .toSorted((left, right) => byPersianName(left.name, right.name));
  }
}
