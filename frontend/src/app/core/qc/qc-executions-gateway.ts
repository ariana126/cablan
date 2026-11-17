import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { QcExecutionsService } from '../../api/qc-executions/qc-executions.service';
import {
  QcExecutionControllerHistory200CountsItem,
  QcExecutionControllerHistory200ExecutionsItem,
  QcExecutionControllerHistoryParams,
} from '../../api/model';

/** One QC record, names current (a correction shows at once), newest first. */
export interface AppQcExecution {
  readonly id: string;
  readonly equipmentId: string;
  readonly equipmentName: string;
  readonly activityId: string;
  readonly activityName: string;
  readonly performedById: string;
  readonly performedByName: string;
  /** ISO instant. */
  readonly performedAt: string;
  readonly trackingNumber: string;
  readonly notes: string | null;
  /** The previous record of the same activity on the same equipment, over every record. */
  readonly previousPerformedAt: string | null;
  /** Whole minutes since it, `null` for the first record. */
  readonly intervalMinutes: number | null;
}

/** How many records one activity has on one equipment, under the filters. */
export interface AppQcExecutionCount {
  readonly equipmentId: string;
  readonly equipmentName: string;
  readonly activityId: string;
  readonly activityName: string;
  readonly count: number;
}

export interface AppQcExecutionHistory {
  readonly executions: readonly AppQcExecution[];
  readonly counts: readonly AppQcExecutionCount[];
}

/** Every filter optional and ANDed by the API; `from`/`to` are inclusive ISO instants. A blank
 * value (`''`, or a tracking number of spaces) is no filter. */
export interface AppQcExecutionFilters {
  readonly from?: string;
  readonly to?: string;
  readonly equipmentId?: string;
  readonly activityId?: string;
  readonly performedById?: string;
  readonly trackingNumber?: string;
}

export interface AppQcFilterOption {
  readonly id: string;
  readonly name: string;
}

export interface AppQcEquipmentFilterOption extends AppQcFilterOption {
  readonly retired: boolean;
}

export interface AppQcExecutionFilterOptions {
  readonly equipment: readonly AppQcEquipmentFilterOption[];
  readonly activities: readonly AppQcFilterOption[];
  readonly performers: readonly AppQcFilterOption[];
}

const toAppQcExecution = (item: QcExecutionControllerHistory200ExecutionsItem): AppQcExecution => ({
  id: item.id ?? '',
  equipmentId: item.equipmentId ?? '',
  equipmentName: item.equipmentName ?? '',
  activityId: item.activityId ?? '',
  activityName: item.activityName ?? '',
  performedById: item.performedById ?? '',
  performedByName: item.performedByName ?? '',
  performedAt: item.performedAt ?? '',
  trackingNumber: item.trackingNumber ?? '',
  notes: item.notes ?? null,
  previousPerformedAt: item.previousPerformedAt ?? null,
  intervalMinutes: item.intervalMinutes ?? null,
});

const toAppQcExecutionCount = (
  item: QcExecutionControllerHistory200CountsItem,
): AppQcExecutionCount => ({
  equipmentId: item.equipmentId ?? '',
  equipmentName: item.equipmentName ?? '',
  activityId: item.activityId ?? '',
  activityName: item.activityName ?? '',
  count: item.count ?? 0,
});

const toOption = (item: { id?: string; name?: string }): AppQcFilterOption => ({
  id: item.id ?? '',
  name: item.name ?? '',
});

/** The filters as query parameters, each blank one left off the request. */
function toParams(filters: AppQcExecutionFilters): QcExecutionControllerHistoryParams {
  const trackingNumber = filters.trackingNumber?.trim() ?? '';
  const entries = Object.entries({ ...filters, trackingNumber }).filter(
    ([, value]) => value !== undefined && value !== '',
  );
  return Object.fromEntries(entries) as QcExecutionControllerHistoryParams;
}

/**
 * The QC records (issue #119) — Management and the System Admin read them, with the interval since
 * each one's previous record and the counts per activity per equipment, both computed by the API;
 * only the System Admin deletes one.
 */
@Injectable({ providedIn: 'root' })
export class QcExecutionsGateway {
  private readonly api = inject(QcExecutionsService);

  history(filters: AppQcExecutionFilters): Observable<AppQcExecutionHistory> {
    return this.api.qcExecutionControllerHistory(toParams(filters)).pipe(
      map((answer) => ({
        executions: (answer.executions ?? []).map(toAppQcExecution),
        counts: (answer.counts ?? []).map(toAppQcExecutionCount),
      })),
    );
  }

  filterOptions(): Observable<AppQcExecutionFilterOptions> {
    return this.api.qcExecutionControllerFilterOptions().pipe(
      map((answer) => ({
        equipment: (answer.equipment ?? []).map((item) => ({
          ...toOption(item),
          retired: item.retired ?? false,
        })),
        activities: (answer.activities ?? []).map(toOption),
        performers: (answer.performers ?? []).map(toOption),
      })),
    );
  }

  delete(id: string): Observable<void> {
    return this.api.qcExecutionControllerDelete(id);
  }
}
