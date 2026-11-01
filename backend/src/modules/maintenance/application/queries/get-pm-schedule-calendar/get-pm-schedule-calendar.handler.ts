import { PmOccurrenceReadModel } from '@maintenance/application/service/pm-occurrence.read-model';
import {
  byCalendarDate,
  PmOccurrenceFinder,
} from '@maintenance/application/service/pm-occurrence-finder';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { GetPmScheduleCalendarQuery } from './get-pm-schedule-calendar.query';

/**
 * The PM schedule's calendar: the table's rows, but ranged on where each one
 * sits in the calendar — the day it was done when late, its due date
 * otherwise. Ordered as the table.
 */
@QueryHandler(GetPmScheduleCalendarQuery)
export class GetPmScheduleCalendarHandler implements IQueryHandler<GetPmScheduleCalendarQuery> {
  constructor(private readonly finder: PmOccurrenceFinder) {}

  async execute(
    query: GetPmScheduleCalendarQuery,
  ): Promise<PmOccurrenceReadModel[]> {
    return this.finder.find(
      query.from,
      query.to,
      query.filters,
      byCalendarDate,
    );
  }
}
