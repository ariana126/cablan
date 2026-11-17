import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { QcEquipmentService } from '../../api/qc-equipment/qc-equipment.service';
import {
  QcEquipmentControllerGet200,
  QcEquipmentControllerGet200ActivitiesItem,
  QcEquipmentControllerList200Item,
} from '../../api/model';

/** One equipment on the QC shelf (`/qc-equipment`). */
export interface AppQcEquipmentSummary {
  readonly id: string;
  readonly name: string;
  readonly retired: boolean;
  readonly assignedActivityCount: number;
}

/** A QC activity assigned to an equipment, with its latest record there, ever. */
export interface AppQcActivityStatus {
  readonly activityId: string;
  readonly activityName: string;
  /** ISO instant, `null` when the activity was never recorded on this equipment («بدون سابقه»). */
  readonly lastPerformedAt: string | null;
}

/** An equipment with the QC activities assigned to it now, by name — the folder and inspection view. */
export interface AppQcEquipment {
  readonly id: string;
  readonly name: string;
  readonly retired: boolean;
  readonly activities: readonly AppQcActivityStatus[];
}

const toAppQcEquipmentSummary = (
  item: QcEquipmentControllerList200Item,
): AppQcEquipmentSummary => ({
  id: item.id ?? '',
  name: item.name ?? '',
  retired: item.retired ?? false,
  assignedActivityCount: item.assignedActivityCount ?? 0,
});

const toAppQcActivityStatus = (
  item: QcEquipmentControllerGet200ActivitiesItem,
): AppQcActivityStatus => ({
  activityId: item.activityId ?? '',
  activityName: item.activityName ?? '',
  lastPerformedAt: item.lastPerformedAt ?? null,
});

/** Shared with `QcInspectionsGateway`, whose answers have the same shape. */
export const toAppQcEquipment = (item: QcEquipmentControllerGet200): AppQcEquipment => ({
  id: item.id ?? '',
  name: item.name ?? '',
  retired: item.retired ?? false,
  activities: (item.activities ?? []).map(toAppQcActivityStatus),
});

/**
 * Each equipment's QC folder (issue #119) — Management and the System Admin: which QC activities are
 * assigned to it, assigning and unassigning them. Retired equipment is read-only (409
 * `equipment-retired`); an unassignment keeps every record.
 */
@Injectable({ providedIn: 'root' })
export class QcEquipmentGateway {
  private readonly api = inject(QcEquipmentService);

  /** Every equipment, retired included, by name. */
  list(): Observable<AppQcEquipmentSummary[]> {
    return this.api
      .qcEquipmentControllerList()
      .pipe(map((items) => items.map(toAppQcEquipmentSummary)));
  }

  get(equipmentId: string): Observable<AppQcEquipment> {
    return this.api.qcEquipmentControllerGet(equipmentId).pipe(map(toAppQcEquipment));
  }

  assign(equipmentId: string, activityId: string): Observable<void> {
    return this.api.qcEquipmentControllerAssign(equipmentId, { activityId });
  }

  unassign(equipmentId: string, activityId: string): Observable<void> {
    return this.api.qcEquipmentControllerUnassign(equipmentId, activityId);
  }
}
