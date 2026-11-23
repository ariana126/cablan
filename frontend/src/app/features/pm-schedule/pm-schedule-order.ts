import { AppPmOccurrence } from '../../core/maintenance/pm-schedule-gateway';

/** Persian collation, so equipment and activity names order as a Persian reader expects. */
const collator = new Intl.Collator('fa');

/**
 * «جدول PM»'s order (issue #131): the earliest due date first, across the whole result rather than
 * equipment by equipment as the API sends it; equal dates by equipment, then by activity, so the
 * order is the same on every read. ISO dates compare as plain strings. Occurrences alike in all three
 * keep the API's own order (`sort` is stable). Returns a new list.
 */
export function sortedByDueDate(
  occurrences: readonly AppPmOccurrence[],
): readonly AppPmOccurrence[] {
  return [...occurrences].sort(
    (first, second) =>
      compareIso(first.dueDate, second.dueDate) ||
      collator.compare(first.equipmentName, second.equipmentName) ||
      collator.compare(first.activityName, second.activityName),
  );
}

function compareIso(first: string, second: string): number {
  if (first === second) {
    return 0;
  }
  return first < second ? -1 : 1;
}
