import { MaintenanceActivityRepository } from '@maintenance/domain/service/maintenance-activity.repository';
import { ActivitySpecialtyValue } from '@maintenance/domain/value/activity-specialty.vo';

/** An activity as the catalog has it now. */
export interface CurrentActivity {
  readonly name: string;
  /** `null` for an activity without a specialty («تخصص تعیین نشده»). */
  readonly specialty: ActivitySpecialtyValue | null;
}

/** The catalog, by activity id. */
export type ActivityCatalog = ReadonlyMap<string, CurrentActivity>;

/**
 * The whole catalog, read once — what every read showing an activity's
 * current name or specialty looks it up in.
 */
export async function readActivityCatalog(
  activityRepository: MaintenanceActivityRepository,
): Promise<ActivityCatalog> {
  const activities = await activityRepository.list();
  return new Map(
    activities.map((activity) => [
      activity.id.asString(),
      {
        name: activity.name().asString(),
        specialty: activity.specialty()?.asString() ?? null,
      },
    ]),
  );
}
