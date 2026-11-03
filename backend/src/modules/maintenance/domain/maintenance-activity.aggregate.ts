import { AggregateRoot, Identity } from '@framework/domain';

import {
  MaintenanceActivityEdited,
  MaintenanceActivityFieldChange,
} from './events/maintenance-activity-edited.event';
import { MaintenanceActivityRegistered } from './events/maintenance-activity-registered.event';
import { MaintenanceActivitySpecialtyAssigned } from './events/maintenance-activity-specialty-assigned.event';
import { ActivityAlreadyHasSpecialty } from './exceptions/activity-already-has-specialty.exception';
import { ActivitySpecialty } from './value/activity-specialty.vo';
import { MaintenanceActivityName } from './value/maintenance-activity-name.vo';

/**
 * An entry of the reusable catalog of maintenance work («تعویض روغن»), of
 * one specialty. Every activity registered since issue #108 has one; an
 * activity registered before has none (`null`, «تخصص تعیین نشده») until the
 * System Admin's one-time completion gives it one.
 */
export class MaintenanceActivity extends AggregateRoot {
  private constructor(
    id: Identity,
    private _name: MaintenanceActivityName,
    private _specialty: ActivitySpecialty | null,
  ) {
    super(id);
  }

  public static register(
    name: MaintenanceActivityName,
    specialty: ActivitySpecialty,
  ): MaintenanceActivity {
    const activity = new MaintenanceActivity(Identity.new(), name, specialty);
    activity.recordThat(
      new MaintenanceActivityRegistered(
        activity.id.asString(),
        name.asString(),
        specialty.asString(),
      ),
    );
    return activity;
  }

  /** Rehydrates from storage; records no event. */
  public static fromPersistence(
    id: Identity,
    name: MaintenanceActivityName,
    specialty: ActivitySpecialty | null,
  ): MaintenanceActivity {
    return new MaintenanceActivity(id, name, specialty);
  }

  /**
   * The general edit: its name and its specialty, recorded as one
   * `MaintenanceActivityEdited` listing only the fields that really changed —
   * nothing at all when neither did. Whether it may be edited at all (no PM
   * plan holds it) is the caller's check.
   */
  public edit(
    name: MaintenanceActivityName,
    specialty: ActivitySpecialty,
  ): void {
    const changes: MaintenanceActivityFieldChange[] = [];
    if (!name.equals(this._name)) {
      changes.push({
        field: 'name',
        previousValue: this._name.asString(),
        newValue: name.asString(),
      });
    }
    if (!this._specialty?.equals(specialty)) {
      changes.push({
        field: 'specialty',
        previousValue: this._specialty?.asString() ?? '',
        newValue: specialty.asString(),
      });
    }
    if (changes.length === 0) {
      return;
    }
    this._name = name;
    this._specialty = specialty;
    this.recordThat(
      new MaintenanceActivityEdited(
        this.id.asString(),
        name.asString(),
        changes,
      ),
    );
  }

  /**
   * Gives an activity registered before specialties existed the specialty it
   * lacks («تخصص تعیین نشده»). The one change that bypasses the PM-plan lock,
   * so it may only ever fill in a missing specialty, never replace one.
   */
  public completeMissingSpecialty(specialty: ActivitySpecialty): void {
    if (this._specialty !== null) {
      throw ActivityAlreadyHasSpecialty.forActivity(this.id.asString());
    }
    this._specialty = specialty;
    this.recordThat(
      new MaintenanceActivitySpecialtyAssigned(
        this.id.asString(),
        this._name.asString(),
        specialty.asString(),
      ),
    );
  }

  public name(): MaintenanceActivityName {
    return this._name;
  }

  /** `null` for an activity registered before specialties existed, until assigned. */
  public specialty(): ActivitySpecialty | null {
    return this._specialty;
  }

  public hasSpecialty(): boolean {
    return this._specialty !== null;
  }
}
