/**
 * The most days a PM schedule read may span, both ends counted — about ten
 * years, room for a long history while a range over a 1-day interval stays
 * a few thousand rows per item, not millions.
 */
export const MAX_PM_SCHEDULE_RANGE_DAYS = 3660;
