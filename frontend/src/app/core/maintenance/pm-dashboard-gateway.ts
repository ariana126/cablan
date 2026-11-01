import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import {
  PmDashboardControllerDashboard200,
  PmDashboardControllerDashboard200OccurrencesItem,
  PmDashboardControllerDashboard200TrendDailyItem,
  PmDashboardControllerDashboardParams,
} from '../../api/model';
import { PmDashboardService } from '../../api/pm-dashboard/pm-dashboard.service';
import { PmOccurrenceStatus } from '../i18n/pm-status-labels';

/** The three periods the dashboard reads: the last 7, 30 or 90 days, today (Tehran) included. */
export type PmDashboardPeriod = 7 | 30 | 90;

/** What the dashboard is asked for: a period, and one piece of equipment or `null` for all. */
export interface AppPmDashboardQuery {
  readonly periodDays: PmDashboardPeriod;
  readonly equipmentId: string | null;
}

/** One point of the performance trend — a day, or a week counted back from yesterday. */
export interface AppPmDashboardTrendPoint {
  /** ISO `YYYY-MM-DD`, inclusive. */
  readonly from: string;
  readonly to: string;
  readonly considered: number;
  readonly onTime: number;
  readonly late: number;
  /** Whole percent; `null` when nothing was due in the point. */
  readonly adherencePercent: number | null;
  readonly completionPercent: number | null;
}

/** One occurrence of the follow-up table. Dates are ISO `YYYY-MM-DD` (the Tehran day). */
export interface AppPmDashboardOccurrence {
  readonly equipmentId: string;
  readonly equipmentName: string;
  readonly equipmentRetired: boolean;
  readonly planItemId: string;
  readonly activityId: string;
  readonly activityName: string;
  readonly dueDate: string;
  readonly status: PmOccurrenceStatus;
  /** Days since the due date while overdue; `0` otherwise. */
  readonly daysOverdue: number;
  /** Days after the due date it was done; `null` unless late. */
  readonly daysLate: number | null;
  /** The day it turned missed; `null` unless missed. */
  readonly missedOn: string | null;
  /** ISO-8601 instant; `null` while not performed. */
  readonly performedAt: string | null;
  readonly performedByName: string | null;
  readonly notes: string | null;
  /** Performed today, whatever its due date. */
  readonly doneToday: boolean;
  /** Due or overdue on an active item of equipment in service: «ثبت انجام» takes it. */
  readonly recordable: boolean;
}

export interface AppPmDashboardPerformance {
  readonly considered: number;
  readonly onTime: number;
  readonly late: number;
  readonly notDone: number;
  readonly adherencePercent: number | null;
  readonly completionPercent: number | null;
  /** One decimal; `null` when nothing was late. */
  readonly averageDaysLate: number | null;
}

export interface AppPmDashboardCoverage {
  readonly activeEquipment: number;
  readonly withPlan: number;
  readonly withoutPlan: number;
  /** Whole percent; `null` when no equipment is active. */
  readonly coveragePercent: number | null;
  /** By Persian name. */
  readonly equipmentWithoutPlan: readonly { readonly id: string; readonly name: string }[];
}

export interface AppPmDashboardOverdueEquipment {
  readonly equipmentId: string;
  readonly equipmentName: string;
  readonly overdueCount: number;
  readonly totalDaysOverdue: number;
}

export interface AppPmDashboardUpcoming {
  readonly equipmentId: string;
  readonly equipmentName: string;
  readonly planItemId: string;
  readonly activityName: string;
  readonly dueDate: string;
}

/**
 * The technical management dashboard as of the API's "today" — every figure is computed there, so
 * the page never derives one from the browser's date.
 */
export interface AppPmDashboard {
  /** ISO date, Tehran. */
  readonly today: string;
  /** ISO instant the figures were computed at. */
  readonly generatedAt: string;
  readonly periodDays: PmDashboardPeriod;
  readonly periodFrom: string;
  readonly periodTo: string;
  readonly current: {
    readonly dueToday: number;
    readonly overdue: number;
    readonly doneToday: number;
  };
  readonly missedCount: number;
  readonly performance: AppPmDashboardPerformance;
  readonly trend: {
    readonly daily: readonly AppPmDashboardTrendPoint[];
    readonly weekly: readonly AppPmDashboardTrendPoint[];
  };
  readonly coverage: AppPmDashboardCoverage;
  /** By overdue count, then total days overdue, then name. */
  readonly mostOverdueEquipment: readonly AppPmDashboardOverdueEquipment[];
  /** By due date, equipment name, plan order. */
  readonly upcoming: readonly AppPmDashboardUpcoming[];
  /** By equipment name, plan order, due date. */
  readonly occurrences: readonly AppPmDashboardOccurrence[];
}

const toTrendPoint = (
  point: PmDashboardControllerDashboard200TrendDailyItem,
): AppPmDashboardTrendPoint => ({
  from: point.from ?? '',
  to: point.to ?? '',
  considered: point.considered ?? 0,
  onTime: point.onTime ?? 0,
  late: point.late ?? 0,
  adherencePercent: point.adherencePercent ?? null,
  completionPercent: point.completionPercent ?? null,
});

const toOccurrence = (
  item: PmDashboardControllerDashboard200OccurrencesItem,
): AppPmDashboardOccurrence => ({
  equipmentId: item.equipmentId ?? '',
  equipmentName: item.equipmentName ?? '',
  equipmentRetired: item.equipmentRetired ?? false,
  planItemId: item.planItemId ?? '',
  activityId: item.activityId ?? '',
  activityName: item.activityName ?? '',
  dueDate: item.dueDate ?? '',
  status: item.status ?? 'upcoming',
  daysOverdue: item.daysOverdue ?? 0,
  daysLate: item.daysLate ?? null,
  missedOn: item.missedOn ?? null,
  performedAt: item.performedAt ?? null,
  performedByName: item.performedByName ?? null,
  notes: item.notes ?? null,
  doneToday: item.doneToday ?? false,
  recordable: item.recordable ?? false,
});

const toAppPmDashboard = (dashboard: PmDashboardControllerDashboard200): AppPmDashboard => {
  const { current, performance, trend, coverage } = dashboard;
  return {
    today: dashboard.today ?? '',
    generatedAt: dashboard.generatedAt ?? '',
    periodDays: dashboard.periodDays ?? 30,
    periodFrom: dashboard.periodFrom ?? '',
    periodTo: dashboard.periodTo ?? '',
    current: {
      dueToday: current?.dueToday ?? 0,
      overdue: current?.overdue ?? 0,
      doneToday: current?.doneToday ?? 0,
    },
    missedCount: dashboard.missedCount ?? 0,
    performance: {
      considered: performance?.considered ?? 0,
      onTime: performance?.onTime ?? 0,
      late: performance?.late ?? 0,
      notDone: performance?.notDone ?? 0,
      adherencePercent: performance?.adherencePercent ?? null,
      completionPercent: performance?.completionPercent ?? null,
      averageDaysLate: performance?.averageDaysLate ?? null,
    },
    trend: {
      daily: (trend?.daily ?? []).map(toTrendPoint),
      weekly: (trend?.weekly ?? []).map(toTrendPoint),
    },
    coverage: {
      activeEquipment: coverage?.activeEquipment ?? 0,
      withPlan: coverage?.withPlan ?? 0,
      withoutPlan: coverage?.withoutPlan ?? 0,
      coveragePercent: coverage?.coveragePercent ?? null,
      equipmentWithoutPlan: (coverage?.equipmentWithoutPlan ?? []).map((equipment) => ({
        id: equipment.id ?? '',
        name: equipment.name ?? '',
      })),
    },
    mostOverdueEquipment: (dashboard.mostOverdueEquipment ?? []).map((row) => ({
      equipmentId: row.equipmentId ?? '',
      equipmentName: row.equipmentName ?? '',
      overdueCount: row.overdueCount ?? 0,
      totalDaysOverdue: row.totalDaysOverdue ?? 0,
    })),
    upcoming: (dashboard.upcoming ?? []).map((row) => ({
      equipmentId: row.equipmentId ?? '',
      equipmentName: row.equipmentName ?? '',
      planItemId: row.planItemId ?? '',
      activityName: row.activityName ?? '',
      dueDate: row.dueDate ?? '',
    })),
    occurrences: (dashboard.occurrences ?? []).map(toOccurrence),
  };
};

/** The query as the API takes it: «همه تجهیزات» leaves `equipmentId` off. */
const toParams = (query: AppPmDashboardQuery): PmDashboardControllerDashboardParams => ({
  periodDays: query.periodDays,
  ...(query.equipmentId === null ? {} : { equipmentId: query.equipmentId }),
});

/**
 * `GET /pm-dashboard` — «داشبورد مدیریتی فنی» (issue #89). One request answers every panel, so all
 * of them stand on the same "today". System Admin and Technical Manager only.
 */
@Injectable({ providedIn: 'root' })
export class PmDashboardGateway {
  private readonly api = inject(PmDashboardService);

  dashboard(query: AppPmDashboardQuery): Observable<AppPmDashboard> {
    return this.api.pmDashboardControllerDashboard(toParams(query)).pipe(map(toAppPmDashboard));
  }
}
