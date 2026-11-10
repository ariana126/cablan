import { byPersianName } from '@maintenance/application/service/persian-order';
import {
  PmPlanReader,
  ReadablePmPlanItem,
} from '@maintenance/application/service/pm-plan-reader';
import { MaintenanceExecution } from '@maintenance/domain/maintenance-execution.aggregate';
import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { MaintenanceExecutionRepository } from '@maintenance/domain/service/maintenance-execution.repository';
import { CalendarDate } from '@maintenance/domain/value/calendar-date.vo';
import { CalendarDateRange } from '@maintenance/domain/value/calendar-date-range.vo';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { GetEquipmentMaintenanceHistoryQuery } from './get-equipment-maintenance-history.query';
import { MaintenanceHistoryEntryReadModel } from './maintenance-history-entry.read-model';

/** An entry and the day the history places it on. */
interface DatedEntry {
  readonly entry: MaintenanceHistoryEntryReadModel;
  /** A job's Tehran performed day; a missed occurrence's due date. */
  readonly day: CalendarDate;
  /** When a job was performed; `null` for a missed occurrence. */
  readonly performedAt: Date | null;
}

/**
 * One piece of equipment's PM history (issue #114): every job done on it,
 * plus every occurrence that is `missed` today — not done by the time its
 * next due date came — each separately. Deactivated items and retired
 * equipment are included, judged as their history stands
 * (`Equipment.occurrencesOf`): no due date after a deactivation day, and
 * none inside a service gap (the days a retired equipment was out of
 * service), while one due before a retirement — its retirement day
 * included — still turns missed by the schedule's next due date. `due`,
 * `overdue` and `upcoming` occurrences never appear.
 *
 * Newest first by the history date — a job's Tehran performed day, a missed
 * occurrence's due date; on one day, jobs before missed occurrences, jobs
 * by the time performed, newest first; then by activity name. A range keeps
 * the entries whose history date is in it: the jobs filtered here, the
 * missed occurrences computed for it alone (`occurrencesMissedIn`).
 *
 * The activity's specialty is the catalog's current one, not a snapshot: it
 * cannot change once a PM plan holds the activity, so it is also the
 * specialty a job was done under — and an activity registered before
 * specialties existed shows the one assigned since.
 */
@QueryHandler(GetEquipmentMaintenanceHistoryQuery)
export class GetEquipmentMaintenanceHistoryHandler implements IQueryHandler<GetEquipmentMaintenanceHistoryQuery> {
  constructor(
    private readonly equipmentRepository: EquipmentRepository,
    private readonly executionRepository: MaintenanceExecutionRepository,
    private readonly planReader: PmPlanReader,
  ) {}

  async execute(
    query: GetEquipmentMaintenanceHistoryQuery,
  ): Promise<MaintenanceHistoryEntryReadModel[]> {
    const equipment = await this.equipmentRepository.get(query.equipmentId);
    const executions = await this.executionRepository.forEquipment(
      equipment.id,
    );
    const [readable] = await this.planReader.readWithHistory(
      [equipment],
      () => true,
      () => Promise.resolve(executions),
    );
    const planItems = readable?.planItems ?? [];
    const today = this.planReader.today();
    const { range } = query;
    const entries = [
      ...executions
        .map((execution) => executed(execution, planItems))
        .filter(({ day }) => !range || range.contains(day)),
      ...planItems.flatMap((planItem) => missedIn(planItem, range, today)),
    ];
    return entries.toSorted(newestFirst).map(({ entry }) => entry);
  }
}

function executed(
  execution: MaintenanceExecution,
  planItems: readonly ReadablePmPlanItem[],
): DatedEntry {
  const planItem = planItems.find(({ item }) =>
    item.id.equals(execution.planItemId()),
  );
  return {
    entry: MaintenanceHistoryEntryReadModel.executed(
      execution,
      planItem?.activitySpecialty ?? null,
    ),
    day: execution.performedOn(),
    performedAt: execution.performedAt(),
  };
}

function missedIn(
  planItem: ReadablePmPlanItem,
  range: CalendarDateRange | null,
  today: CalendarDate,
): DatedEntry[] {
  return planItem.occurrences
    .occurrencesMissedIn(range, today)
    .map((occurrence) => ({
      entry: MaintenanceHistoryEntryReadModel.missed(planItem, occurrence),
      day: occurrence.dueDate,
      performedAt: null,
    }));
}

function newestFirst(left: DatedEntry, right: DatedEntry): number {
  return (
    left.day.daysUntil(right.day) ||
    performedNewestFirst(left.performedAt, right.performedAt) ||
    byPersianName(left.entry.activityName, right.entry.activityName)
  );
}

/** Jobs before missed occurrences, jobs newest first. */
function performedNewestFirst(left: Date | null, right: Date | null): number {
  if (left && right) {
    return right.getTime() - left.getTime();
  }
  return (left ? -1 : 0) + (right ? 1 : 0);
}
