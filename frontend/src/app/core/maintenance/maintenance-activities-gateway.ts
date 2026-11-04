import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { MaintenanceActivitiesService } from '../../api/maintenance-activities/maintenance-activities.service';
import {
  MaintenanceActivityControllerList200Item,
  MaintenanceActivityControllerWithoutSpecialty200Item,
} from '../../api/model';
import { ActivitySpecialty } from '../i18n/specialty-labels';
import { toActivitySpecialty } from './specialty-groups';

/** One activity of the reusable maintenance catalog («تعویض روغن»). */
export interface AppMaintenanceActivity {
  readonly id: string;
  readonly name: string;
  /** `null` only for an activity registered before specialties existed, until it is assigned one. */
  readonly specialty: ActivitySpecialty | null;
}

/** What the add and edit dialogs send: both fields, always together. */
export interface MaintenanceActivityDetails {
  readonly name: string;
  readonly specialty: ActivitySpecialty;
}

/** An activity still waiting for its specialty (issue #108). */
export interface AppUnassignedActivity {
  readonly id: string;
  readonly name: string;
}

export interface SpecialtyAssignment {
  readonly activityId: string;
  readonly specialty: ActivitySpecialty;
}

const toAppMaintenanceActivity = (
  item: MaintenanceActivityControllerList200Item,
): AppMaintenanceActivity => ({
  id: item.id ?? '',
  name: item.name ?? '',
  specialty: toActivitySpecialty(item.specialty),
});

const toAppUnassignedActivity = (
  item: MaintenanceActivityControllerWithoutSpecialty200Item,
): AppUnassignedActivity => ({ id: item.id ?? '', name: item.name ?? '' });

/**
 * The maintenance-activity catalog — System Admin and Technical Manager only; the legacy specialty
 * assignment is System Admin's alone.
 */
@Injectable({ providedIn: 'root' })
export class MaintenanceActivitiesGateway {
  private readonly api = inject(MaintenanceActivitiesService);

  list(): Observable<AppMaintenanceActivity[]> {
    return this.api
      .maintenanceActivityControllerList()
      .pipe(map((items) => items.map(toAppMaintenanceActivity)));
  }

  register(details: MaintenanceActivityDetails): Observable<void> {
    return this.api
      .maintenanceActivityControllerRegister({ name: details.name, specialty: details.specialty })
      .pipe(map(() => undefined));
  }

  /**
   * Name and specialty together — refused (409) while any PM plan item uses the activity, unless it
   * is the System Admin's correction of the name alone (`applyToRelatedRecords`, issue #110), which
   * the API carries into the plan and the history.
   */
  edit(
    id: string,
    details: MaintenanceActivityDetails,
    applyToRelatedRecords = false,
  ): Observable<void> {
    return this.api.maintenanceActivityControllerEdit(id, {
      name: details.name,
      specialty: details.specialty,
      ...(applyToRelatedRecords ? { applyToRelatedRecords } : {}),
    });
  }

  /** The activities without a specialty, by name — empty once the system admin assigned them all. */
  unassignedSpecialties(): Observable<AppUnassignedActivity[]> {
    return this.api
      .maintenanceActivityControllerWithoutSpecialty()
      .pipe(map((items) => items.map(toAppUnassignedActivity)));
  }

  /** All or nothing: the API refuses (400) unless every unassigned activity is named once. */
  assignSpecialties(assignments: readonly SpecialtyAssignment[]): Observable<void> {
    return this.api.maintenanceActivityControllerCompleteMissingSpecialties({
      assignments: assignments.map(({ activityId, specialty }) => ({ activityId, specialty })),
    });
  }
}
