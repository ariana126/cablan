import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { QcEquipmentService } from '../../api/qc-equipment/qc-equipment.service';
import { QcInspectionsService } from '../../api/qc-inspections/qc-inspections.service';
import { AppQcEquipment, toAppQcEquipment } from './qc-equipment-gateway';

/** What «ثبت انجام» sends: who and when come from the token and the API's clock, never from here. */
export interface QcExecutionRecord {
  /** Required, any text; the API refuses a blank one. */
  readonly trackingNumber: string;
  /** Optional; blank is left out. */
  readonly notes: string;
}

/**
 * The in-production inspection (issue #119) — the QC inspector, Management and the System Admin: the
 * equipment a QR code names, its assigned activities with their last execution, and recording one
 * as done.
 */
@Injectable({ providedIn: 'root' })
export class QcInspectionsGateway {
  private readonly inspections = inject(QcInspectionsService);
  private readonly equipment = inject(QcEquipmentService);

  /** In-service equipment with at least one assigned activity, by name. */
  list(): Observable<AppQcEquipment[]> {
    return this.inspections
      .qcInspectionControllerList()
      .pipe(map((items) => items.map(toAppQcEquipment)));
  }

  /** Any equipment by id — retired included (`retired: true`), unknown a 404. */
  get(equipmentId: string): Observable<AppQcEquipment> {
    return this.inspections.qcInspectionControllerGet(equipmentId).pipe(map(toAppQcEquipment));
  }

  record(equipmentId: string, activityId: string, record: QcExecutionRecord): Observable<void> {
    const notes = record.notes.trim();
    return this.equipment
      .qcEquipmentControllerRecord(equipmentId, activityId, {
        trackingNumber: record.trackingNumber,
        ...(notes === '' ? {} : { notes: record.notes }),
      })
      .pipe(map(() => undefined));
  }
}
