import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { IntervalUnit, RecordMaintenanceExecutionDto } from '../../api/model';
import { PmPlansService } from '../../api/pm-plans/pm-plans.service';

/** A new plan item as the add dialog collects it. `firstDueDate` is ISO `YYYY-MM-DD`. */
export interface NewPmPlanItem {
  readonly activityId: string;
  readonly intervalDays: number;
  readonly firstDueDate: string;
}

/**
 * Writes to an equipment's PM plan, and recording that a job was done.
 *
 * The contract's `intervalUnit` also names `operating_hours`; the API refuses it
 * (`usage-based-interval-not-supported`) and the UI never offers it, so every plan item goes out in
 * days.
 */
@Injectable({ providedIn: 'root' })
export class PmPlansGateway {
  private readonly api = inject(PmPlansService);

  addItem(equipmentId: string, item: NewPmPlanItem): Observable<void> {
    return this.api
      .pmPlanItemControllerAdd(equipmentId, {
        activityId: item.activityId,
        intervalValue: item.intervalDays,
        intervalUnit: IntervalUnit.days,
        firstDueDate: item.firstDueDate,
      })
      .pipe(map(() => undefined));
  }

  changeInterval(equipmentId: string, itemId: string, intervalDays: number): Observable<void> {
    return this.api.pmPlanItemControllerChangeInterval(equipmentId, itemId, { intervalDays });
  }

  removeItem(equipmentId: string, itemId: string): Observable<void> {
    return this.api.pmPlanItemControllerRemove(equipmentId, itemId);
  }

  /** Recorded now, by whoever is signed in — the API decides which occurrence it lands on. */
  recordExecution(equipmentId: string, itemId: string, notes: string): Observable<void> {
    const body: RecordMaintenanceExecutionDto = notes.trim() === '' ? {} : { notes };
    return this.api
      .pmPlanItemControllerRecordExecution(equipmentId, itemId, body)
      .pipe(map(() => undefined));
  }
}
