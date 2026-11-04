/**
 * Held by every command that writes an equipment's or an activity's name into
 * the maintenance history (issue #110, reviewer M3): recording an execution,
 * which snapshots both names, and the System Admin's correction of either,
 * which rewrites those snapshots. Without it, an execution recorded while a
 * correction runs could keep the old name the correction just rewrote
 * everywhere else.
 *
 * The activity edit takes it after `ACTIVITY_SPECIALTY_LOCK`, and nothing
 * takes the two in the other order, so they cannot deadlock.
 */
export const PM_SNAPSHOT_NAMES_LOCK = 'maintenance:pm-snapshot-names';
