import { PmPlanReader } from '@maintenance/application/service/pm-plan-reader';
import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { GetPmScheduleOverviewQuery } from './get-pm-schedule-overview.query';
import { PmOccurrenceReadModel } from './pm-occurrence.read-model';

/**
 * The maintenance status view: for every active item of equipment in
 * service, every occurrence from its first due date through the next one not
 * yet reached, with its status and who did it when. Ordered by equipment
 * name, plan order, due date.
 */
@QueryHandler(GetPmScheduleOverviewQuery)
export class GetPmScheduleOverviewHandler implements IQueryHandler<GetPmScheduleOverviewQuery> {
  constructor(
    private readonly equipmentRepository: EquipmentRepository,
    private readonly planReader: PmPlanReader,
  ) {}

  async execute(): Promise<PmOccurrenceReadModel[]> {
    const today = this.planReader.today();
    const rows: PmOccurrenceReadModel[] = [];

    const equipment = await this.planReader.read(
      this.planReader.inService(await this.equipmentRepository.list()),
    );
    for (const { equipment: candidate, planItems } of equipment) {
      for (const { item, activityName, occurrences } of planItems) {
        for (const occurrence of occurrences.occurrencesThrough(today)) {
          rows.push(
            new PmOccurrenceReadModel(
              candidate.id.asString(),
              candidate.name().asString(),
              item.id.asString(),
              activityName,
              occurrence.dueDate.asString(),
              occurrence.status,
              occurrence.execution?.performedAt().toISOString() ?? null,
              occurrence.execution?.performedByName() ?? null,
            ),
          );
        }
      }
    }
    return rows;
  }
}
