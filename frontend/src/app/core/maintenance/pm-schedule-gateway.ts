import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import {
  PmScheduleControllerDaily200Item,
  PmScheduleControllerDaily200ItemStatus,
  PmScheduleControllerOverview200Item,
} from '../../api/model';
import { PmScheduleService } from '../../api/pm-schedule/pm-schedule.service';
import { PmOccurrenceStatus } from '../i18n/pm-status-labels';

/** One row of today's list: work due today or overdue. Dates are ISO `YYYY-MM-DD`. */
export interface AppDailyPmTask {
  readonly equipmentId: string;
  readonly equipmentName: string;
  readonly planItemId: string;
  readonly activityId: string;
  readonly activityName: string;
  readonly dueDate: string;
  readonly status: PmScheduleControllerDaily200ItemStatus;
  /** `0` when due today. */
  readonly daysOverdue: number;
}

/** One occurrence of an active plan item, performed or not. */
export interface AppPmOccurrence {
  readonly equipmentId: string;
  readonly equipmentName: string;
  readonly planItemId: string;
  readonly activityName: string;
  readonly dueDate: string;
  readonly status: PmOccurrenceStatus;
  /** ISO-8601 instant, `null` while not performed. */
  readonly performedAt: string | null;
  readonly performedBy: string | null;
  /** Whole days after the due date it was done — a positive number when `late`, else `null`. */
  readonly daysLate: number | null;
}

const toAppDailyPmTask = (item: PmScheduleControllerDaily200Item): AppDailyPmTask => ({
  equipmentId: item.equipmentId ?? '',
  equipmentName: item.equipmentName ?? '',
  planItemId: item.planItemId ?? '',
  activityId: item.activityId ?? '',
  activityName: item.activityName ?? '',
  dueDate: item.dueDate ?? '',
  status: item.status ?? 'due',
  daysOverdue: item.daysOverdue ?? 0,
});

const toAppPmOccurrence = (item: PmScheduleControllerOverview200Item): AppPmOccurrence => ({
  equipmentId: item.equipmentId ?? '',
  equipmentName: item.equipmentName ?? '',
  planItemId: item.planItemId ?? '',
  activityName: item.activityName ?? '',
  dueDate: item.dueDate ?? '',
  status: item.status ?? 'upcoming',
  performedAt: item.performedAt ?? null,
  performedBy: item.performedBy ?? null,
  daysLate: item.daysLate ?? null,
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

  /** Every occurrence so far, through the next one not yet reached; by equipment, plan, due date. */
  overview(): Observable<AppPmOccurrence[]> {
    return this.api
      .pmScheduleControllerOverview()
      .pipe(map((items) => items.map(toAppPmOccurrence)));
  }
}
