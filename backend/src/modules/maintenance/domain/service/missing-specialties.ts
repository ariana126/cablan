import { Identity } from '@framework/domain';

import { SpecialtyAssignmentMismatch } from '../exceptions/specialty-assignment-mismatch.exception';
import { MaintenanceActivity } from '../maintenance-activity.aggregate';
import { ActivitySpecialty } from '../value/activity-specialty.vo';

/** One activity without a specialty, and the specialty it is given. */
export interface SpecialtyAssignment {
  readonly activityId: Identity;
  readonly specialty: ActivitySpecialty;
}

/**
 * The catalog's activities without a specialty («تخصص تعیین نشده») —
 * registered before specialties existed — and the rule for completing them:
 * all at once, every one named exactly once and nothing else.
 */
export class MissingSpecialties {
  private constructor(
    private readonly activities: ReadonlyMap<string, MaintenanceActivity>,
  ) {}

  static in(catalog: readonly MaintenanceActivity[]): MissingSpecialties {
    return new MissingSpecialties(
      new Map(
        catalog
          .filter((activity) => !activity.hasSpecialty())
          .map((activity) => [activity.id.asString(), activity]),
      ),
    );
  }

  /**
   * Gives each activity the specialty assigned to it and returns the
   * activities changed, in the order assigned. Checks the whole assignment
   * before changing any activity, so a refusal leaves every one as it was.
   */
  complete(assignments: readonly SpecialtyAssignment[]): MaintenanceActivity[] {
    const matched = this.matchExactly(assignments);
    for (const { activity, specialty } of matched) {
      activity.completeMissingSpecialty(specialty);
    }
    return matched.map(({ activity }) => activity);
  }

  private matchExactly(
    assignments: readonly SpecialtyAssignment[],
  ): { activity: MaintenanceActivity; specialty: ActivitySpecialty }[] {
    const matched = new Map<
      string,
      { activity: MaintenanceActivity; specialty: ActivitySpecialty }
    >();
    const unexpected: string[] = [];
    for (const { activityId, specialty } of assignments) {
      const id = activityId.asString();
      const activity = this.activities.get(id);
      if (!activity || matched.has(id)) {
        unexpected.push(id);
      } else {
        matched.set(id, { activity, specialty });
      }
    }
    const missing = [...this.activities.keys()].filter(
      (id) => !matched.has(id),
    );
    if (missing.length > 0 || unexpected.length > 0) {
      throw SpecialtyAssignmentMismatch.of(missing, unexpected);
    }
    return [...matched.values()];
  }
}
