import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { EquipmentService } from '../../api/equipment/equipment.service';
import {
  EquipmentControllerGet200,
  EquipmentControllerGet200PlanItemsItem,
  EquipmentControllerList200Item,
  EquipmentControllerMaintenanceHistory200Item,
  EquipmentControllerMaintenanceHistory200ItemStatus,
} from '../../api/model';

/** A piece of equipment as the list shows it — every field present. */
export interface AppEquipment {
  readonly id: string;
  readonly name: string;
  /** Retired equipment stays listed (its history is kept) but has no active plan. */
  readonly retired: boolean;
}

/** One active item of an equipment's PM plan. Dates are ISO `YYYY-MM-DD`. */
export interface AppPmPlanItem {
  readonly id: string;
  readonly activityId: string;
  readonly activityName: string;
  readonly intervalDays: number;
  readonly firstDueDate: string;
  readonly nextDueDate: string;
}

export interface AppEquipmentDetail extends AppEquipment {
  /** Active items only, in the order they were added. */
  readonly planItems: readonly AppPmPlanItem[];
}

export type MaintenanceExecutionStatus = EquipmentControllerMaintenanceHistory200ItemStatus;

/** One recorded execution — the history, which later plan changes never rewrite. */
export interface AppMaintenanceExecution {
  readonly id: string;
  readonly activityName: string;
  /** The occurrence it was recorded for, ISO `YYYY-MM-DD`. */
  readonly dueDate: string;
  /** ISO-8601 instant. */
  readonly performedAt: string;
  /** The recorder's display name. */
  readonly performedBy: string;
  readonly status: MaintenanceExecutionStatus;
  /** `''` when none was written. */
  readonly notes: string;
  /** Whole days after the due date it was done — a positive number when `late`, else `null`. */
  readonly daysLate: number | null;
}

const toAppEquipment = (item: EquipmentControllerList200Item): AppEquipment => ({
  id: item.id ?? '',
  name: item.name ?? '',
  retired: item.retired ?? false,
});

const toAppPmPlanItem = (item: EquipmentControllerGet200PlanItemsItem): AppPmPlanItem => ({
  id: item.id ?? '',
  activityId: item.activityId ?? '',
  activityName: item.activityName ?? '',
  intervalDays: item.intervalDays ?? 0,
  firstDueDate: item.firstDueDate ?? '',
  nextDueDate: item.nextDueDate ?? '',
});

const toAppEquipmentDetail = (detail: EquipmentControllerGet200): AppEquipmentDetail => ({
  ...toAppEquipment(detail),
  planItems: (detail.planItems ?? []).map(toAppPmPlanItem),
});

const toAppMaintenanceExecution = (
  item: EquipmentControllerMaintenanceHistory200Item,
): AppMaintenanceExecution => ({
  id: item.id ?? '',
  activityName: item.activityName ?? '',
  dueDate: item.dueDate ?? '',
  performedAt: item.performedAt ?? '',
  performedBy: item.performedBy ?? '',
  status: item.status ?? 'on_time',
  notes: item.notes ?? '',
  daysLate: item.daysLate ?? null,
});

/**
 * Equipment and its PM plan. The list, the detail and every write are for System Admin and
 * Technical Manager; the maintenance history is readable by the PM Inspector too.
 */
@Injectable({ providedIn: 'root' })
export class EquipmentGateway {
  private readonly api = inject(EquipmentService);

  list(): Observable<AppEquipment[]> {
    return this.api.equipmentControllerList().pipe(map((items) => items.map(toAppEquipment)));
  }

  get(id: string): Observable<AppEquipmentDetail> {
    return this.api.equipmentControllerGet(id).pipe(map(toAppEquipmentDetail));
  }

  register(name: string): Observable<void> {
    return this.api.equipmentControllerRegister({ name }).pipe(map(() => undefined));
  }

  rename(id: string, name: string): Observable<void> {
    return this.api.equipmentControllerRename(id, { name });
  }

  retire(id: string): Observable<void> {
    return this.api.equipmentControllerRetire(id);
  }

  /** Newest first, executions of removed items and of a retired equipment included. */
  maintenanceHistory(id: string): Observable<AppMaintenanceExecution[]> {
    return this.api
      .equipmentControllerMaintenanceHistory(id)
      .pipe(map((items) => items.map(toAppMaintenanceExecution)));
  }
}
