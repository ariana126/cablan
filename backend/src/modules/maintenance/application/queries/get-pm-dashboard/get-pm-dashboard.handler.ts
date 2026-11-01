import { Clock, Identity } from '@framework/domain';
import { byPersianName } from '@maintenance/application/service/persian-order';
import {
  PmPlanReader,
  ReadableEquipment,
} from '@maintenance/application/service/pm-plan-reader';
import { Equipment } from '@maintenance/domain/equipment.aggregate';
import { MaintenanceExecution } from '@maintenance/domain/maintenance-execution.aggregate';
import { PmCoverage } from '@maintenance/domain/pm-coverage';
import { PmOccurrence } from '@maintenance/domain/pm-occurrences';
import { PmPerformance } from '@maintenance/domain/pm-performance';
import { ReadonlyPmPlanItem } from '@maintenance/domain/pm-plan-item.entity';
import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import {
  MaintenanceExecutionRepository,
  PlanItemDueDateRange,
} from '@maintenance/domain/service/maintenance-execution.repository';
import { CalendarDate } from '@maintenance/domain/value/calendar-date.vo';
import { CalendarDateRange } from '@maintenance/domain/value/calendar-date-range.vo';
import { PmDashboardPeriod } from '@maintenance/domain/value/pm-dashboard-period.vo';
import { PmOccurrenceStatus } from '@maintenance/domain/value/pm-occurrence-status';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { GetPmDashboardQuery } from './get-pm-dashboard.query';
import {
  PmDashboardCoverage,
  PmDashboardOccurrence,
  PmDashboardOverdueEquipment,
  PmDashboardPerformance,
  PmDashboardReadModel,
  PmDashboardTrendPoint,
  PmDashboardUpcoming,
} from './pm-dashboard.read-model';

/** One occurrence the dashboard shows, with what it belongs to. */
interface ShownOccurrence {
  readonly equipment: Equipment;
  readonly item: ReadonlyPmPlanItem;
  readonly activityName: string;
  readonly occurrence: PmOccurrence<MaintenanceExecution>;
  /** Its item in force (`Equipment.isInForce`). */
  readonly active: boolean;
  readonly doneToday: boolean;
  /** It awaits recording now, as `Equipment.recordExecutionOf` would take it. */
  readonly recordable: boolean;
}

/**
 * The technical management dashboard: today's work, the period's missed
 * occurrences and performance (with its trend), plant-wide PM coverage, the
 * equipment with the most overdue work, the next seven days and the
 * follow-up table — all from the schedules, the executions and today, through
 * the domain's `PmOccurrences`; nothing is stored. Deactivated items and
 * retired equipment keep their history up to the day they stopped.
 *
 * Each plan item loads only the occurrences due from the period's first day
 * through a week ahead, plus the one just before the period (the only earlier
 * one that can still be overdue, or turn missed inside it), and the
 * executions of those plus the ones performed today.
 */
@QueryHandler(GetPmDashboardQuery)
export class GetPmDashboardHandler implements IQueryHandler<GetPmDashboardQuery> {
  constructor(
    private readonly equipmentRepository: EquipmentRepository,
    private readonly executionRepository: MaintenanceExecutionRepository,
    private readonly planReader: PmPlanReader,
    private readonly clock: Clock,
  ) {}

  async execute(query: GetPmDashboardQuery): Promise<PmDashboardReadModel> {
    const now = this.clock.now();
    const period = PmDashboardPeriod.endingOn(
      CalendarDate.inTehranOf(now),
      query.periodDays,
    );
    const allEquipment = await this.equipmentRepository.list();
    const shownEquipment = query.equipmentId
      ? [
          await this.equipmentRepository.get(
            Identity.fromString(query.equipmentId),
          ),
        ]
      : this.planReader.byName(allEquipment);
    const shown = await this.shownOccurrences(shownEquipment, period);
    const occurrences = shown.map(({ occurrence }) => occurrence);

    return new PmDashboardReadModel({
      today: period.today.asString(),
      generatedAt: now.toISOString(),
      periodDays: period.days(),
      periodFrom: period.from.asString(),
      periodTo: period.today.asString(),
      current: {
        dueToday: countActive(shown, PmOccurrenceStatus.Due),
        overdue: countActive(shown, PmOccurrenceStatus.Overdue),
        doneToday: shown.filter(({ doneToday }) => doneToday).length,
      },
      missedCount: occurrences.filter((occurrence) =>
        period.sawTurnMissed(occurrence),
      ).length,
      performance: performanceOf(
        PmPerformance.of(occurrences, period.pastDays()),
      ),
      trend: {
        daily: period
          .dailyBuckets()
          .map((bucket) => trendPoint(occurrences, bucket)),
        weekly: period
          .weeklyBuckets()
          .map((bucket) => trendPoint(occurrences, bucket)),
      },
      coverage: coverageOf(PmCoverage.of(allEquipment)),
      mostOverdueEquipment: mostOverdue(shown),
      upcoming: upcomingIn(shown, period.nextSevenDays()),
      occurrences: shown.map((row) => followUpRow(row)),
    });
  }

  /**
   * Every occurrence the panels count, by equipment name, plan order, then
   * due date: those the period follows up in each item's due-date window,
   * and any done today.
   */
  private async shownOccurrences(
    equipment: readonly Equipment[],
    period: PmDashboardPeriod,
  ): Promise<ShownOccurrence[]> {
    const windows: PlanItemDueDateRange[] = equipment.flatMap((candidate) =>
      candidate.planItems().map((item) => ({
        planItemId: item.id,
        range: period.dueDateWindowOf(item.schedule()),
      })),
    );
    const executions = await this.executionsFor(windows, period.today);
    const plans = await this.planReader.readWithHistory(
      equipment,
      () => true,
      () => Promise.resolve(executions),
    );
    const doneToday = executions.filter((execution) =>
      execution.performedOn().equals(period.today),
    );
    return plans.flatMap((plan) => shownOf(plan, doneToday, period));
  }

  /** Each item's executions due in its window, and every one performed today. */
  private async executionsFor(
    windows: readonly PlanItemDueDateRange[],
    today: CalendarDate,
  ): Promise<MaintenanceExecution[]> {
    const dueInWindows =
      await this.executionRepository.dueWithinOwnRanges(windows);
    const performedToday = await this.executionRepository.dueOrPerformedIn(
      windows.map(({ planItemId }) => planItemId),
      CalendarDateRange.between(today, today),
    );
    const byId = new Map(
      [...dueInWindows, ...performedToday].map((execution) => [
        execution.id.asString(),
        execution,
      ]),
    );
    return [...byId.values()];
  }
}

function shownOf(
  { equipment, planItems }: ReadableEquipment,
  doneToday: readonly MaintenanceExecution[],
  period: PmDashboardPeriod,
): ShownOccurrence[] {
  return planItems.flatMap(({ item, activityName, occurrences }) => {
    const followedUp = occurrences
      .occurrencesDueIn(period.dueDateWindowOf(item.schedule()), period.today)
      .filter((occurrence) => period.followsUp(occurrence));
    const shownDueDates = new Set(
      followedUp.map(({ dueDate }) => dueDate.asString()),
    );
    const stopDate = equipment.stopDateOf(item);
    const alsoDoneToday = doneToday
      .filter(
        (execution) =>
          execution.planItemId().equals(item.id) &&
          !shownDueDates.has(execution.dueDate().asString()) &&
          !(stopDate && execution.dueDate().isAfter(stopDate)),
      )
      .map((execution) =>
        occurrences.occurrenceOn(execution.dueDate(), period.today),
      );
    const active = equipment.isInForce(item);
    return [...followedUp, ...alsoDoneToday]
      .toSorted((left, right) => right.dueDate.daysUntil(left.dueDate))
      .map((occurrence) => ({
        equipment,
        item,
        activityName,
        occurrence,
        active,
        doneToday:
          occurrence.execution?.performedOn().equals(period.today) ?? false,
        recordable:
          active &&
          occurrences.awaitsRecording(occurrence.dueDate, period.today),
      }));
  });
}

function countActive(
  shown: readonly ShownOccurrence[],
  status: PmOccurrenceStatus,
): number {
  return shown.filter(
    ({ active, occurrence }) => active && occurrence.status === status,
  ).length;
}

function performanceOf(performance: PmPerformance): PmDashboardPerformance {
  return {
    considered: performance.considered(),
    onTime: performance.onTime(),
    late: performance.late(),
    notDone: performance.notDone(),
    adherencePercent: performance.adherencePercent(),
    completionPercent: performance.completionPercent(),
    averageDaysLate: performance.averageDaysLate(),
  };
}

function trendPoint(
  occurrences: readonly PmOccurrence<MaintenanceExecution>[],
  bucket: CalendarDateRange,
): PmDashboardTrendPoint {
  const performance = PmPerformance.of(occurrences, bucket);
  return {
    from: bucket.from.asString(),
    to: bucket.to.asString(),
    considered: performance.considered(),
    onTime: performance.onTime(),
    late: performance.late(),
    adherencePercent: performance.adherencePercent(),
    completionPercent: performance.completionPercent(),
  };
}

/** Coverage as the dashboard shows it, the equipment without a plan by name. */
function coverageOf(coverage: PmCoverage): PmDashboardCoverage {
  return {
    activeEquipment: coverage.inService(),
    withPlan: coverage.withPlan(),
    withoutPlan: coverage.withoutPlan().length,
    coveragePercent: coverage.coveragePercent(),
    equipmentWithoutPlan: coverage
      .withoutPlan()
      .map((equipment) => ({
        id: equipment.id.asString(),
        name: equipment.name().asString(),
      }))
      .toSorted((left, right) => byPersianName(left.name, right.name)),
  };
}

/**
 * Per piece of equipment, its overdue occurrences (missed ones are not
 * overdue) on items in force: most first, then most days overdue, then by
 * name. Only equipment with at least one.
 */
function mostOverdue(
  shown: readonly ShownOccurrence[],
): PmDashboardOverdueEquipment[] {
  const byEquipment = new Map<string, PmDashboardOverdueEquipment>();
  for (const { equipment, occurrence, active } of shown) {
    if (!active || occurrence.status !== PmOccurrenceStatus.Overdue) {
      continue;
    }
    const key = equipment.id.asString();
    const sofar = byEquipment.get(key);
    byEquipment.set(key, {
      equipmentId: key,
      equipmentName: equipment.name().asString(),
      overdueCount: (sofar?.overdueCount ?? 0) + 1,
      totalDaysOverdue: (sofar?.totalDaysOverdue ?? 0) + occurrence.daysOverdue,
    });
  }
  return [...byEquipment.values()].toSorted(
    (left, right) =>
      right.overdueCount - left.overdueCount ||
      right.totalDaysOverdue - left.totalDaysOverdue ||
      byPersianName(left.equipmentName, right.equipmentName),
  );
}

/**
 * What is still to come on items in force in `days`, by due date, then
 * equipment name and plan order (the order `shown` already has).
 */
function upcomingIn(
  shown: readonly ShownOccurrence[],
  days: CalendarDateRange,
): PmDashboardUpcoming[] {
  return shown
    .filter(
      ({ active, occurrence }) =>
        active &&
        occurrence.status === PmOccurrenceStatus.Upcoming &&
        days.contains(occurrence.dueDate),
    )
    .toSorted((left, right) =>
      right.occurrence.dueDate.daysUntil(left.occurrence.dueDate),
    )
    .map(({ equipment, item, activityName, occurrence }) => ({
      equipmentId: equipment.id.asString(),
      equipmentName: equipment.name().asString(),
      planItemId: item.id.asString(),
      activityName,
      dueDate: occurrence.dueDate.asString(),
    }));
}

function followUpRow({
  equipment,
  item,
  activityName,
  occurrence,
  doneToday,
  recordable,
}: ShownOccurrence): PmDashboardOccurrence {
  const execution = occurrence.execution;
  return {
    equipmentId: equipment.id.asString(),
    equipmentName: equipment.name().asString(),
    equipmentRetired: equipment.isRetired(),
    planItemId: item.id.asString(),
    activityId: item.activityId().asString(),
    activityName,
    dueDate: occurrence.dueDate.asString(),
    status: occurrence.status,
    daysOverdue: occurrence.daysOverdue,
    daysLate: execution?.daysLate() ?? null,
    missedOn: occurrence.missedOn?.asString() ?? null,
    performedAt: execution?.performedAt().toISOString() ?? null,
    performedByName: execution?.performedByName() ?? null,
    notes: execution?.notes() ?? null,
    doneToday,
    recordable,
  };
}
