const MILLISECONDS_PER_MINUTE = 60_000;

/**
 * The interval between two QC records of one activity on one piece of
 * equipment, in whole minutes, floored — a record 2 min 59 s after the
 * previous one is 2 minutes after it. Computed on every read, never stored.
 */
export function wholeMinutesBetween(previous: Date, performedAt: Date): number {
  return Math.floor(
    (performedAt.getTime() - previous.getTime()) / MILLISECONDS_PER_MINUTE,
  );
}
