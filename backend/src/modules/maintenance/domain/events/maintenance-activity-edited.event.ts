import { DomainEvent } from '@framework/domain';

// One entry per field that actually changed in a single edit — never for a
// field resent unchanged. `MaintenanceActivity.edit()` computes this while the
// old values are still on hand. A specialty given for the first time reads
// from `''`.
export interface MaintenanceActivityFieldChange {
  readonly field: 'name' | 'specialty';
  readonly previousValue: string;
  readonly newValue: string;
}

/** One edit of a catalog activity: its name, its specialty, or both. */
export class MaintenanceActivityEdited implements DomainEvent {
  constructor(
    public readonly activityId: string,
    /** The activity's name after the edit. */
    public readonly activityName: string,
    public readonly changes: MaintenanceActivityFieldChange[],
  ) {}
}
