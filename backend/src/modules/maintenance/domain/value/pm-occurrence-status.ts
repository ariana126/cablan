/**
 * Where one occurrence of a PM plan item stands — the design's status table:
 * executed on or before its due date (`on_time`, بموقع) or after it (`late`,
 * با تاخیر); otherwise, against today, `missed` (انجام نشده) once the next
 * occurrence is reached, `overdue` (عقب افتاده) before that, `due` (سررسیده)
 * on the day itself, `upcoming` before it. The values cross HTTP as they are.
 */
export enum PmOccurrenceStatus {
  OnTime = 'on_time',
  Late = 'late',
  Missed = 'missed',
  Overdue = 'overdue',
  Due = 'due',
  Upcoming = 'upcoming',
}
