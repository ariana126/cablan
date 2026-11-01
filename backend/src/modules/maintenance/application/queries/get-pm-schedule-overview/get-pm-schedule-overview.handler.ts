import { PmOccurrenceReadModel } from '@maintenance/application/service/pm-occurrence.read-model';
import {
  byDueDate,
  PmOccurrenceFinder,
} from '@maintenance/application/service/pm-occurrence-finder';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { GetPmScheduleOverviewQuery } from './get-pm-schedule-overview.query';

/**
 * The PM schedule's table: every occurrence whose due date is in the range —
 * past and future, deactivated items and retired equipment up to the day they
 * stopped — with its status today, who did it when and how late. Ordered by
 * equipment name, plan order, due date.
 */
@QueryHandler(GetPmScheduleOverviewQuery)
export class GetPmScheduleOverviewHandler implements IQueryHandler<GetPmScheduleOverviewQuery> {
  constructor(private readonly finder: PmOccurrenceFinder) {}

  async execute(
    query: GetPmScheduleOverviewQuery,
  ): Promise<PmOccurrenceReadModel[]> {
    return this.finder.find(query.from, query.to, query.filters, byDueDate);
  }
}
