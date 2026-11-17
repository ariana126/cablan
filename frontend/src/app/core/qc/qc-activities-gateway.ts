import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { QcActivitiesService } from '../../api/qc-activities/qc-activities.service';
import { QcActivityControllerList200Item } from '../../api/model';

/** One activity of the QC catalog («بازرسی ابعادی»), defined once and assigned to equipment. */
export interface AppQcActivity {
  readonly id: string;
  readonly name: string;
  /** The equipment it is assigned to now, retired included. */
  readonly assignedEquipmentCount: number;
}

const toAppQcActivity = (item: QcActivityControllerList200Item): AppQcActivity => ({
  id: item.id ?? '',
  name: item.name ?? '',
  assignedEquipmentCount: item.assignedEquipmentCount ?? 0,
});

/**
 * The QC activity catalog (issue #119) — Management and the System Admin. An activity assigned or
 * ever recorded is refused a rename or a delete (409 `record-has-dependents`), except the System
 * Admin's correction of its name (`applyToRelatedRecords`).
 */
@Injectable({ providedIn: 'root' })
export class QcActivitiesGateway {
  private readonly api = inject(QcActivitiesService);

  /** By name. */
  list(): Observable<AppQcActivity[]> {
    return this.api.qcActivityControllerList().pipe(map((items) => items.map(toAppQcActivity)));
  }

  /** Answers the new activity's id. */
  define(name: string): Observable<string> {
    return this.api.qcActivityControllerDefine({ name }).pipe(map((created) => created.id ?? ''));
  }

  rename(id: string, name: string, applyToRelatedRecords = false): Observable<void> {
    return this.api.qcActivityControllerRename(id, {
      name,
      ...(applyToRelatedRecords ? { applyToRelatedRecords } : {}),
    });
  }

  delete(id: string): Observable<void> {
    return this.api.qcActivityControllerDelete(id);
  }
}
