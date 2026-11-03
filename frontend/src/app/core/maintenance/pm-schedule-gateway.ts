import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import {
  PmScheduleControllerCalendar200Item,
  PmScheduleControllerDaily200Item,
  PmScheduleControllerDaily200ItemStatus,
  PmScheduleControllerFilterOptions200,
  PmScheduleControllerOverview200Item,
  PmScheduleControllerOverviewParams,
} from '../../api/model';
import { PmScheduleService } from '../../api/pm-schedule/pm-schedule.service';
import { PmOccurrenceStatus } from '../i18n/pm-status-labels';
import { ActivitySpecialty } from '../i18n/specialty-labels';
import { toActivitySpecialty } from './specialty-groups';

/** One row of today's list: work due today or overdue. Dates are ISO `YYYY-MM-DD`. */
export interface AppDailyPmTask {
  readonly equipmentId: string;
  readonly equipmentName: string;
  readonly planItemId: string;
  readonly activityId: string;
  readonly activityName: string;
  /** `null` while the activity has none («تخصص تعیین نشده»). */
  readonly activitySpecialty: ActivitySpecialty | null;
  readonly dueDate: string;
  readonly status: PmScheduleControllerDaily200ItemStatus;
  /** `0` when due today. */
  readonly daysOverdue: number;
}

/**
 * One occurrence of a plan item in the schedule, past or future, performed or not. Dates are ISO
 * `YYYY-MM-DD` (the Tehran day).
 */
export interface AppPmOccurrence {
  readonly equipmentId: string;
  readonly equipmentName: string;
  readonly equipmentRetired: boolean;
  readonly planItemId: string;
  readonly activityId: string;
  /** The activity's current catalog name. */
  readonly activityName: string;
  readonly activitySpecialty: ActivitySpecialty | null;
  readonly dueDate: string;
  /** The day a calendar shows it on: the day it was done when late, else its due date. */
  readonly calendarDate: string;
  readonly status: PmOccurrenceStatus;
  /** ISO-8601 instant, `null` while not performed. */
  readonly performedAt: string | null;
  readonly performedById: string | null;
  readonly performedBy: string | null;
  /** Whole days after the due date it was done — a positive number when `late`, else `null`. */
  readonly daysLate: number | null;
  readonly notes: string | null;
}

/**
 * What both schedule reads ask: an inclusive range of ISO dates, and the five filters — `null` for
 * «همه», which leaves the parameter off the request.
 */
export interface AppPmScheduleQuery {
  readonly from: string;
  readonly to: string;
  readonly equipmentId: string | null;
  readonly activityId: string | null;
  readonly status: PmOccurrenceStatus | null;
  readonly performedById: string | null;
  /** An activity without a specialty is never among either specialty's. */
  readonly specialty: ActivitySpecialty | null;
}

export interface AppPmScheduleEquipmentOption {
  readonly id: string;
  readonly name: string;
  readonly retired: boolean;
}

export interface AppPmScheduleNamedOption {
  readonly id: string;
  readonly name: string;
}

/** The choices of the schedule's filters, each list by name. */
export interface AppPmScheduleFilterOptions {
  readonly equipment: readonly AppPmScheduleEquipmentOption[];
  readonly activities: readonly AppPmScheduleNamedOption[];
  readonly performers: readonly AppPmScheduleNamedOption[];
}

const toAppDailyPmTask = (item: PmScheduleControllerDaily200Item): AppDailyPmTask => ({
  equipmentId: item.equipmentId ?? '',
  equipmentName: item.equipmentName ?? '',
  planItemId: item.planItemId ?? '',
  activityId: item.activityId ?? '',
  activityName: item.activityName ?? '',
  activitySpecialty: toActivitySpecialty(item.activitySpecialty),
  dueDate: item.dueDate ?? '',
  status: item.status ?? 'due',
  daysOverdue: item.daysOverdue ?? 0,
});

const toAppPmOccurrence = (
  item: PmScheduleControllerOverview200Item | PmScheduleControllerCalendar200Item,
): AppPmOccurrence => ({
  equipmentId: item.equipmentId ?? '',
  equipmentName: item.equipmentName ?? '',
  equipmentRetired: item.equipmentRetired ?? false,
  planItemId: item.planItemId ?? '',
  activityId: item.activityId ?? '',
  activityName: item.activityName ?? '',
  activitySpecialty: toActivitySpecialty(item.activitySpecialty),
  dueDate: item.dueDate ?? '',
  calendarDate: item.calendarDate ?? item.dueDate ?? '',
  status: item.status ?? 'upcoming',
  performedAt: item.performedAt ?? null,
  performedById: item.performedById ?? null,
  performedBy: item.performedBy ?? null,
  daysLate: item.daysLate ?? null,
  notes: item.notes ?? null,
});

const named = (option: { id?: string; name?: string }): AppPmScheduleNamedOption => ({
  id: option.id ?? '',
  name: option.name ?? '',
});

const toAppFilterOptions = (
  options: PmScheduleControllerFilterOptions200,
): AppPmScheduleFilterOptions => ({
  equipment: (options.equipment ?? []).map((option) => ({
    ...named(option),
    retired: option.retired ?? false,
  })),
  activities: (options.activities ?? []).map(named),
  performers: (options.performers ?? []).map(named),
});

/** The query as the API takes it: a filter on «همه» is left off rather than sent empty. */
const toParams = (query: AppPmScheduleQuery): PmScheduleControllerOverviewParams => ({
  from: query.from,
  to: query.to,
  ...(query.equipmentId === null ? {} : { equipmentId: query.equipmentId }),
  ...(query.activityId === null ? {} : { activityId: query.activityId }),
  ...(query.status === null ? {} : { status: query.status }),
  ...(query.performedById === null ? {} : { performedById: query.performedById }),
  ...(query.specialty === null ? {} : { specialty: query.specialty }),
});

/**
 * The PM schedule as of "today" — the Tehran date of the API's clock, so the browser's own date
 * never enters into it. Readable by System Admin, Technical Manager and PM Inspector.
 */
@Injectable({ providedIn: 'root' })
export class PmScheduleGateway {
  private readonly api = inject(PmScheduleService);

  /** Ordered by equipment name, then plan order. */
  daily(): Observable<AppDailyPmTask[]> {
    return this.api.pmScheduleControllerDaily().pipe(map((items) => items.map(toAppDailyPmTask)));
  }

  /** Every occurrence due in the range; by equipment, plan order, due date. */
  overview(query: AppPmScheduleQuery): Observable<AppPmOccurrence[]> {
    return this.api
      .pmScheduleControllerOverview(toParams(query))
      .pipe(map((items) => items.map(toAppPmOccurrence)));
  }

  /** The same occurrences, chosen by the day a calendar shows them on (`calendarDate`) instead. */
  calendar(query: AppPmScheduleQuery): Observable<AppPmOccurrence[]> {
    return this.api
      .pmScheduleControllerCalendar(toParams(query))
      .pipe(map((items) => items.map(toAppPmOccurrence)));
  }

  filterOptions(): Observable<AppPmScheduleFilterOptions> {
    return this.api.pmScheduleControllerFilterOptions().pipe(map(toAppFilterOptions));
  }
}
