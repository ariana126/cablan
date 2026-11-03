import { Identity } from '@framework/domain';
import { InvalidPmScheduleRange } from '@maintenance/application/exceptions/invalid-pm-schedule-range.exception';
import { Equipment } from '@maintenance/domain/equipment.aggregate';
import { DateRangeStartsAfterEnd } from '@maintenance/domain/exceptions/date-range-starts-after-end.exception';
import { MaintenanceExecution } from '@maintenance/domain/maintenance-execution.aggregate';
import {
  PmOccurrence,
  PmOccurrences,
} from '@maintenance/domain/pm-occurrences';
import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { MaintenanceExecutionRepository } from '@maintenance/domain/service/maintenance-execution.repository';
import { ActivitySpecialtyValue } from '@maintenance/domain/value/activity-specialty.vo';
import { CalendarDate } from '@maintenance/domain/value/calendar-date.vo';
import { CalendarDateRange } from '@maintenance/domain/value/calendar-date-range.vo';
import { PmOccurrenceStatus } from '@maintenance/domain/value/pm-occurrence-status';
import { MAX_PM_SCHEDULE_RANGE_DAYS } from '@maintenance/domain/value/pm-schedule-range-limit';
import { Injectable } from '@nestjs/common';

import { PmOccurrenceReadModel } from './pm-occurrence.read-model';
import { PmPlanReader } from './pm-plan-reader';

/** The PM schedule's optional filters; every one given must match. */
export interface PmScheduleFilters {
  readonly equipmentId?: string;
  readonly activityId?: string;
  /** Only activities of this specialty — never one that has none yet. */
  readonly specialty?: ActivitySpecialtyValue;
  readonly status?: PmOccurrenceStatus;
  /** A user id; leaves out every occurrence nobody has done. */
  readonly performedById?: string;
}

/**
 * Which date a range is on: the due date (the table) or the calendar date
 * (the calendar). Each names both the executions it needs from the store and
 * the occurrences it takes from the domain, so the two always agree.
 */
export interface PmScheduleView {
  executionsOf(
    repository: MaintenanceExecutionRepository,
    planItemIds: readonly Identity[],
    range: CalendarDateRange,
  ): Promise<MaintenanceExecution[]>;
  occurrencesIn(
    occurrences: PmOccurrences<MaintenanceExecution>,
    range: CalendarDateRange,
    today: CalendarDate,
  ): PmOccurrence<MaintenanceExecution>[];
}

export const byDueDate: PmScheduleView = {
  executionsOf: (repository, planItemIds, range) =>
    repository.dueIn(planItemIds, range),
  occurrencesIn: (occurrences, range, today) =>
    occurrences.occurrencesDueIn(range, today),
};

export const byCalendarDate: PmScheduleView = {
  executionsOf: (repository, planItemIds, range) =>
    repository.dueOrPerformedIn(planItemIds, range),
  occurrencesIn: (occurrences, range, today) =>
    occurrences.occurrencesPlacedIn(range, today),
};

/**
 * The PM schedule's rows in a date range: every occurrence of every plan
 * item — deactivated items and retired equipment included, up to the day they
 * stopped — that the range holds, filtered, ordered by equipment name, plan
 * order, then due date. Shared by the table and the calendar, which differ
 * only in their `PmScheduleView`. It reads only the executions the range
 * needs, never the whole history.
 */
@Injectable()
export class PmOccurrenceFinder {
  constructor(
    private readonly equipmentRepository: EquipmentRepository,
    private readonly executionRepository: MaintenanceExecutionRepository,
    private readonly planReader: PmPlanReader,
  ) {}

  async find(
    from: string | undefined,
    to: string | undefined,
    filters: PmScheduleFilters,
    view: PmScheduleView,
  ): Promise<PmOccurrenceReadModel[]> {
    const range = rangeOf(from, to);
    const today = this.planReader.today();
    const plans = await this.planReader.readWithHistory(
      await this.equipmentFor(filters),
      (item, activity) =>
        (!filters.activityId ||
          item.activityId().asString() === filters.activityId) &&
        (!filters.specialty || activity.specialty === filters.specialty),
      (planItemIds) =>
        view.executionsOf(this.executionRepository, planItemIds, range),
    );

    const rows: PmOccurrenceReadModel[] = [];
    for (const { equipment, planItems } of plans) {
      for (const {
        item,
        activityName,
        activitySpecialty,
        occurrences,
      } of planItems) {
        for (const occurrence of view.occurrencesIn(
          occurrences,
          range,
          today,
        )) {
          if (!matches(occurrence, filters)) {
            continue;
          }
          const execution = occurrence.execution;
          rows.push(
            new PmOccurrenceReadModel({
              equipmentId: equipment.id.asString(),
              equipmentName: equipment.name().asString(),
              equipmentRetired: equipment.isRetired(),
              planItemId: item.id.asString(),
              activityId: item.activityId().asString(),
              activityName,
              activitySpecialty,
              dueDate: occurrence.dueDate.asString(),
              calendarDate: occurrence.calendarDate.asString(),
              status: occurrence.status,
              performedAt: execution?.performedAt().toISOString() ?? null,
              performedById: execution?.performedById().asString() ?? null,
              performedBy: execution?.performedByName() ?? null,
              daysLate: execution?.daysLate() ?? null,
              notes: execution?.notes() ?? null,
            }),
          );
        }
      }
    }
    return rows;
  }

  /** The one piece of equipment filtered on, or all of it, by name. */
  private async equipmentFor(filters: PmScheduleFilters): Promise<Equipment[]> {
    if (filters.equipmentId) {
      const equipment = await this.equipmentRepository.find(
        Identity.fromString(filters.equipmentId),
      );
      return equipment ? [equipment] : [];
    }
    return this.planReader.byName(await this.equipmentRepository.list());
  }
}

/**
 * Both bounds are required (each is already a valid ISO date when given:
 * the request is validated first); that the start may not follow the end is
 * `CalendarDateRange`'s own rule; and a read spans at most
 * `MAX_PM_SCHEDULE_RANGE_DAYS`, so no range can ask for millions of rows.
 */
function rangeOf(
  from: string | undefined,
  to: string | undefined,
): CalendarDateRange {
  if (!from || !to) {
    throw InvalidPmScheduleRange.of(from, to);
  }
  const range = between(from, to);
  if (range.days() > MAX_PM_SCHEDULE_RANGE_DAYS) {
    throw InvalidPmScheduleRange.tooLong(from, to, MAX_PM_SCHEDULE_RANGE_DAYS);
  }
  return range;
}

function between(from: string, to: string): CalendarDateRange {
  try {
    return CalendarDateRange.between(
      CalendarDate.fromString(from),
      CalendarDate.fromString(to),
    );
  } catch (error) {
    if (error instanceof DateRangeStartsAfterEnd) {
      throw InvalidPmScheduleRange.of(from, to);
    }
    throw error;
  }
}

function matches(
  occurrence: PmOccurrence<MaintenanceExecution>,
  filters: PmScheduleFilters,
): boolean {
  if (filters.status && occurrence.status !== filters.status) {
    return false;
  }
  return (
    !filters.performedById ||
    occurrence.execution?.performedById().asString() === filters.performedById
  );
}
