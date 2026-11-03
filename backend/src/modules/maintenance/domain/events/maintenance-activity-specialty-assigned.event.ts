import { DomainEvent } from '@framework/domain';

/**
 * An activity registered before specialties existed given its specialty by
 * the System Admin's one-time assignment — the one change allowed even while
 * a PM plan holds the activity.
 */
export class MaintenanceActivitySpecialtyAssigned implements DomainEvent {
  constructor(
    public readonly activityId: string,
    public readonly activityName: string,
    /** `'electrical'` or `'mechanical'`. */
    public readonly specialty: string,
  ) {}
}
