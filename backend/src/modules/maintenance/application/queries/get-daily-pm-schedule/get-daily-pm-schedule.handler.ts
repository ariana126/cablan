import { PmPlanReader } from '@maintenance/application/service/pm-plan-reader';
import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { PmOccurrenceStatus } from '@maintenance/domain/value/pm-occurrence-status';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { DailyPmTaskReadModel } from './daily-pm-task.read-model';
import { GetDailyPmScheduleQuery } from './get-daily-pm-schedule.query';

/**
 * Today's PM list: for every active item of equipment in service, its
 * current occurrence while that is due or overdue. An earlier occurrence
 * left undone is missed and no longer listed; work ahead is not listed yet.
 * Ordered by equipment name, then plan order.
 */
@QueryHandler(GetDailyPmScheduleQuery)
export class GetDailyPmScheduleHandler implements IQueryHandler<GetDailyPmScheduleQuery> {
  constructor(
    private readonly equipmentRepository: EquipmentRepository,
    private readonly planReader: PmPlanReader,
  ) {}

  async execute(): Promise<DailyPmTaskReadModel[]> {
    const today = this.planReader.today();
    const tasks: DailyPmTaskReadModel[] = [];

    const equipment = await this.planReader.read(
      this.planReader.inService(await this.equipmentRepository.list()),
    );
    for (const { equipment: candidate, planItems } of equipment) {
      for (const { item, activityName, occurrences } of planItems) {
        const current = occurrences.currentOccurrence(today);
        if (
          current?.status !== PmOccurrenceStatus.Due &&
          current?.status !== PmOccurrenceStatus.Overdue
        ) {
          continue;
        }
        tasks.push(
          new DailyPmTaskReadModel(
            candidate.id.asString(),
            candidate.name().asString(),
            item.id.asString(),
            item.activityId().asString(),
            activityName,
            current.dueDate.asString(),
            current.status,
            current.daysOverdue,
          ),
        );
      }
    }
    return tasks;
  }
}
