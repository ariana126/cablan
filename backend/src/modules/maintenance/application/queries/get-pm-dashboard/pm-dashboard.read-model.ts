/** Today's work, whatever the period: active items only, but every job done today. */
export interface PmDashboardCurrent {
  readonly dueToday: number;
  readonly overdue: number;
  readonly doneToday: number;
}

/** The period's past occurrences judged (`PmPerformance`). */
export interface PmDashboardPerformance {
  readonly considered: number;
  readonly onTime: number;
  readonly late: number;
  /** Overdue or missed. */
  readonly notDone: number;
  /** Whole percent done on time; `null` with nothing considered. */
  readonly adherencePercent: number | null;
  /** Whole percent done at all; `null` with nothing considered. */
  readonly completionPercent: number | null;
  /** Mean days late of the late ones, one decimal; `null` with none late. */
  readonly averageDaysLate: number | null;
}

/** One day, or one week, of the performance trend. */
export interface PmDashboardTrendPoint {
  /** ISO `YYYY-MM-DD`, inclusive. */
  readonly from: string;
  /** ISO `YYYY-MM-DD`, inclusive. */
  readonly to: string;
  readonly considered: number;
  readonly onTime: number;
  readonly late: number;
  readonly adherencePercent: number | null;
  readonly completionPercent: number | null;
}

export interface PmDashboardTrend {
  readonly daily: readonly PmDashboardTrendPoint[];
  readonly weekly: readonly PmDashboardTrendPoint[];
}

export interface PmDashboardEquipmentRef {
  readonly id: string;
  readonly name: string;
}

/** Plant-wide: equipment in service, and how much of it has an active PM plan. */
export interface PmDashboardCoverage {
  readonly activeEquipment: number;
  readonly withPlan: number;
  readonly withoutPlan: number;
  /** Whole percent; `null` with no equipment in service. */
  readonly coveragePercent: number | null;
  /** By name. */
  readonly equipmentWithoutPlan: readonly PmDashboardEquipmentRef[];
}

export interface PmDashboardOverdueEquipment {
  readonly equipmentId: string;
  readonly equipmentName: string;
  readonly overdueCount: number;
  readonly totalDaysOverdue: number;
}

export interface PmDashboardUpcoming {
  readonly equipmentId: string;
  readonly equipmentName: string;
  readonly planItemId: string;
  readonly activityName: string;
  /** ISO `YYYY-MM-DD`. */
  readonly dueDate: string;
}

/** One row of the dashboard's follow-up table. */
export interface PmDashboardOccurrence {
  readonly equipmentId: string;
  readonly equipmentName: string;
  readonly equipmentRetired: boolean;
  readonly planItemId: string;
  readonly activityId: string;
  /** The activity's current catalog name. */
  readonly activityName: string;
  /** ISO `YYYY-MM-DD`. */
  readonly dueDate: string;
  /** A `PmOccurrenceStatus` value. */
  readonly status: string;
  /** Days since the due date while `overdue`; `0` otherwise. */
  readonly daysOverdue: number;
  /** Whole Tehran days late, or `null` unless `late`. */
  readonly daysLate: number | null;
  /** ISO `YYYY-MM-DD`: the day it turned `missed`, or `null`. */
  readonly missedOn: string | null;
  /** ISO-8601 instant, or `null` while not done. */
  readonly performedAt: string | null;
  readonly performedByName: string | null;
  readonly notes: string | null;
  /** Performed today (Tehran), whatever its due date. */
  readonly doneToday: boolean;
  /** `due` or `overdue`, on an active item of equipment in service. */
  readonly recordable: boolean;
}

/**
 * The technical management dashboard (issue #89): every number computed
 * from the schedules, the executions and today, nothing stored. The contract
 * is the plan's (docs/superpowers/plans/2026-11-01-technical-management-dashboard.md).
 */
export class PmDashboardReadModel {
  /** ISO `YYYY-MM-DD`, Tehran. */
  readonly today: string;
  /** ISO-8601 instant. */
  readonly generatedAt: string;
  readonly periodDays: number;
  /** ISO `YYYY-MM-DD`: today − (periodDays − 1). */
  readonly periodFrom: string;
  /** ISO `YYYY-MM-DD`: today. */
  readonly periodTo: string;
  readonly current: PmDashboardCurrent;
  /** Missed occurrences that turned missed inside the period. */
  readonly missedCount: number;
  readonly performance: PmDashboardPerformance;
  readonly trend: PmDashboardTrend;
  readonly coverage: PmDashboardCoverage;
  readonly mostOverdueEquipment: readonly PmDashboardOverdueEquipment[];
  readonly upcoming: readonly PmDashboardUpcoming[];
  readonly occurrences: readonly PmDashboardOccurrence[];

  constructor(fields: PmDashboardReadModel) {
    this.today = fields.today;
    this.generatedAt = fields.generatedAt;
    this.periodDays = fields.periodDays;
    this.periodFrom = fields.periodFrom;
    this.periodTo = fields.periodTo;
    this.current = fields.current;
    this.missedCount = fields.missedCount;
    this.performance = fields.performance;
    this.trend = fields.trend;
    this.coverage = fields.coverage;
    this.mostOverdueEquipment = fields.mostOverdueEquipment;
    this.upcoming = fields.upcoming;
    this.occurrences = fields.occurrences;
  }
}
