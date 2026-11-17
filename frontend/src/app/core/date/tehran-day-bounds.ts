import { toIsoCalendarDate } from './calendar-date';

/**
 * Asia/Tehran's offset from UTC. Iran abolished daylight saving time in 2022, so it is one constant
 * — the same assumption `tehranToday` and the API's own Tehran day rest on.
 */
const TEHRAN_OFFSET = '+03:30';

/**
 * The first instant of a calendar day **in Tehran**, as an ISO instant — for an API that filters by
 * instants (`GET /qc-executions?from`) while the visitor picks days. `day` is what a date-only
 * picker writes: the local midnight of the chosen day, read through its local fields.
 */
export function tehranDayStart(day: Date): string {
  return new Date(`${toIsoCalendarDate(day)}T00:00:00.000${TEHRAN_OFFSET}`).toISOString();
}

/** The last millisecond of that Tehran day, so an inclusive `to` takes the whole day in. */
export function tehranDayEnd(day: Date): string {
  return new Date(`${toIsoCalendarDate(day)}T23:59:59.999${TEHRAN_OFFSET}`).toISOString();
}
