/**
 * Held by every command that can set an activity's specialty — the general
 * edit and the one-time completion of the missing ones — so neither acts on
 * an activity loaded before the other saved it. Without it, a completion
 * racing an edit of the same activity without a specialty could overwrite
 * the specialty the edit just gave it.
 */
export const ACTIVITY_SPECIALTY_LOCK = 'maintenance:activity-specialty';
