import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { EquipmentService } from '../../api/equipment/equipment.service';
import {
  EquipmentControllerGet200,
  EquipmentControllerGet200InactivePlanItemsItem,
  EquipmentControllerGet200PlanItemsItem,
  EquipmentControllerList200Item,
  EquipmentControllerMaintenanceHistory200Item,
  EquipmentControllerMaintenanceHistory200ItemStatus,
} from '../../api/model';
import { ActivitySpecialty } from '../i18n/specialty-labels';
import { toActivitySpecialty } from './specialty-groups';

/** What every view of a piece of equipment carries. */
interface AppEquipmentIdentity {
  readonly id: string;
  readonly name: string;
  /** Retired equipment stays listed (its history is kept) but has no active plan. */
  readonly retired: boolean;
}

/** A piece of equipment as the list shows it — every field present. */
export interface AppEquipment extends AppEquipmentIdentity {
  /** Items in its PM plan now, deactivated ones excluded — what `/pm-plans` draws its board by. */
  readonly activePlanItemCount: number;
}

/** One active item of an equipment's PM plan. Dates are ISO `YYYY-MM-DD`. */
export interface AppPmPlanItem {
  readonly id: string;
  readonly activityId: string;
  readonly activityName: string;
  /** `null` while the activity has none («تخصص تعیین نشده»). */
  readonly activitySpecialty: ActivitySpecialty | null;
  readonly intervalDays: number;
  readonly firstDueDate: string;
  readonly nextDueDate: string;
}

/**
 * A plan item taken out of the plan for good (issue #91) — read-only, with the interval in force
 * when it was deactivated. It is never reactivated, re-scheduled or executed again.
 */
export interface AppInactivePmPlanItem {
  readonly id: string;
  readonly activityId: string;
  readonly activityName: string;
  readonly activitySpecialty: ActivitySpecialty | null;
  readonly intervalDays: number;
  /** ISO `YYYY-MM-DD`. */
  readonly firstDueDate: string;
  /** ISO-8601 instant. */
  readonly deactivatedAt: string;
}

export interface AppEquipmentDetail extends AppEquipmentIdentity {
  /** Active items only, in the order they were added. */
  readonly planItems: readonly AppPmPlanItem[];
  /** Deactivated items, earliest deactivated first — the API's order. */
  readonly inactivePlanItems: readonly AppInactivePmPlanItem[];
}

/** How recorded work stands against its due date; `missed` belongs to a missed occurrence alone. */
export type MaintenanceExecutionStatus = Exclude<
  EquipmentControllerMaintenanceHistory200ItemStatus,
  'missed'
>;

/** A plan row restarted at reactivation from a new first due date (ISO `YYYY-MM-DD`), its interval
 * kept. A row not listed continues its previous calendar. */
export interface RescheduledPlanItem {
  readonly planItemId: string;
  readonly firstDueDate: string;
}

/** What every entry of an equipment's maintenance history carries, done or missed. */
interface AppMaintenanceHistoryEntryBase {
  /** The plan row it belongs to — active or deactivated (issue #110). */
  readonly planItemId: string;
  /** The name when the work was recorded; the plan row's current name when missed. */
  readonly activityName: string;
  /** The occurrence, ISO `YYYY-MM-DD`. */
  readonly dueDate: string;
  /** The activity's current specialty — fixed once a plan holds it, so also the one it was done under. */
  readonly activitySpecialty: ActivitySpecialty | null;
}

/** One recorded execution — the history, which later plan changes never rewrite. */
export interface AppMaintenanceExecution extends AppMaintenanceHistoryEntryBase {
  readonly kind: 'executed';
  readonly id: string;
  /** ISO-8601 instant. */
  readonly performedAt: string;
  /** The recorder's display name. */
  readonly performedBy: string;
  readonly status: MaintenanceExecutionStatus;
  /** `''` when none was written. */
  readonly notes: string;
  /** Whole days after the due date it was done — a positive number when `late`, else `null`. */
  readonly daysLate: number | null;
  /** The operating hours the performer reported; `null` when none was given (never read as `0`). */
  readonly operatingHours: number | null;
}

/**
 * A due date nobody did before the next one came (issue #114) — computed by the API, never stored,
 * so it has no id, performer, time or notes, and nothing to delete.
 */
export interface AppMissedOccurrence extends AppMaintenanceHistoryEntryBase {
  readonly kind: 'missed';
  readonly status: 'missed';
}

/** One line of an equipment's «سابقه PM»: work done, or a due date missed. */
export type AppMaintenanceHistoryEntry = AppMaintenanceExecution | AppMissedOccurrence;

/** The days a history read covers, ISO `YYYY-MM-DD`, both included — both bounds or none. */
export interface MaintenanceHistoryRange {
  readonly from: string;
  readonly to: string;
}

const toAppEquipment = (item: EquipmentControllerList200Item): AppEquipment => ({
  id: item.id ?? '',
  name: item.name ?? '',
  retired: item.retired ?? false,
  activePlanItemCount: item.activePlanItemCount ?? 0,
});

const toAppPmPlanItem = (item: EquipmentControllerGet200PlanItemsItem): AppPmPlanItem => ({
  id: item.id ?? '',
  activityId: item.activityId ?? '',
  activityName: item.activityName ?? '',
  activitySpecialty: toActivitySpecialty(item.activitySpecialty),
  intervalDays: item.intervalDays ?? 0,
  firstDueDate: item.firstDueDate ?? '',
  nextDueDate: item.nextDueDate ?? '',
});

const toAppInactivePmPlanItem = (
  item: EquipmentControllerGet200InactivePlanItemsItem,
): AppInactivePmPlanItem => ({
  id: item.id ?? '',
  activityId: item.activityId ?? '',
  activityName: item.activityName ?? '',
  activitySpecialty: toActivitySpecialty(item.activitySpecialty),
  intervalDays: item.intervalDays ?? 0,
  firstDueDate: item.firstDueDate ?? '',
  deactivatedAt: item.deactivatedAt ?? '',
});

const toAppEquipmentDetail = (detail: EquipmentControllerGet200): AppEquipmentDetail => ({
  id: detail.id ?? '',
  name: detail.name ?? '',
  retired: detail.retired ?? false,
  planItems: (detail.planItems ?? []).map(toAppPmPlanItem),
  inactivePlanItems: (detail.inactivePlanItems ?? []).map(toAppInactivePmPlanItem),
});

/** A number, or `null` — a decimal the API ever sent as text («1250.50») reads as the same amount. */
const toOperatingHours = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const hours = Number(value);
  return Number.isFinite(hours) ? hours : null;
};

const toAppMaintenanceHistoryEntry = (
  item: EquipmentControllerMaintenanceHistory200Item,
): AppMaintenanceHistoryEntry => {
  const shared = {
    planItemId: item.planItemId ?? '',
    activityName: item.activityName ?? '',
    dueDate: item.dueDate ?? '',
    activitySpecialty: toActivitySpecialty(item.activitySpecialty),
  };
  if (item.kind === 'missed' || item.status === 'missed') {
    return { kind: 'missed', ...shared, status: 'missed' };
  }
  return {
    kind: 'executed',
    id: item.id ?? '',
    ...shared,
    performedAt: item.performedAt ?? '',
    performedBy: item.performedBy ?? '',
    status: item.status === 'late' ? 'late' : 'on_time',
    notes: item.notes ?? '',
    daysLate: item.daysLate ?? null,
    operatingHours: toOperatingHours(item.operatingHours),
  };
};

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

  /** Answers the new equipment's id — what its folder (`/pm-plans/:id`) is addressed by. */
  register(name: string): Observable<string> {
    return this.api.equipmentControllerRegister({ name }).pipe(map(({ id }) => id ?? ''));
  }

  /**
   * `applyToRelatedRecords` is the System Admin's correction (issue #110): the new name is carried
   * into the plan's and the history's snapshots too, and a retired equipment may be renamed. The API
   * ignores it for anyone else.
   */
  rename(id: string, name: string, applyToRelatedRecords = false): Observable<void> {
    return this.api.equipmentControllerRename(id, {
      name,
      ...(applyToRelatedRecords ? { applyToRelatedRecords } : {}),
    });
  }

  retire(id: string): Observable<void> {
    return this.api.equipmentControllerRetire(id);
  }

  /** System Admin only, retired equipment only (409 `equipment-not-retired`): the equipment, every
   * plan row and every execution under it go, and its name is free again. */
  delete(id: string): Observable<void> {
    return this.api.equipmentControllerDelete(id);
  }

  /** System Admin only, retired equipment only: back in service. Deactivated rows stay so. */
  reactivate(id: string, rescheduled: readonly RescheduledPlanItem[]): Observable<void> {
    return this.api.equipmentControllerReactivate(
      id,
      rescheduled.length === 0
        ? {}
        : {
            rescheduledItems: rescheduled.map(({ planItemId, firstDueDate }) => ({
              planItemId,
              firstDueDate,
            })),
          },
    );
  }

  /**
   * Newest first, executions of deactivated items and of a retired equipment included, and — since
   * issue #114 — the due dates missed, each placed by the API. A `range` keeps work done on those
   * (Tehran) days and missed due dates falling in them; the API owns that rule.
   */
  maintenanceHistory(
    id: string,
    range?: MaintenanceHistoryRange,
  ): Observable<AppMaintenanceHistoryEntry[]> {
    return this.api
      .equipmentControllerMaintenanceHistory(id, range ? { from: range.from, to: range.to } : {})
      .pipe(map((items) => items.map(toAppMaintenanceHistoryEntry)));
  }
}
