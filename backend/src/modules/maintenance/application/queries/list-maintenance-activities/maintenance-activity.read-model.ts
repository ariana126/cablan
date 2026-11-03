import { ActivitySpecialtyValue } from '@maintenance/domain/value/activity-specialty.vo';

export class MaintenanceActivityReadModel {
  constructor(
    public readonly id: string,
    public readonly name: string,
    /** `electrical` or `mechanical`, or `null` for an activity registered before specialties existed. */
    public readonly specialty: ActivitySpecialtyValue | null,
  ) {}
}
