/**
 * The PM schedule's "today" is the API's: the calendar day in Asia/Tehran (see the gateway). A page
 * that marks today or opens on the current month must agree with it, and the browser's own clock
 * does not — a UTC browser at 00:30 Tehran time is still on the day before, and on the last day of
 * a month, on the month before.
 *
 * The platform's `Intl` time-zone data reads the Tehran calendar day off the instant; no time-zone
 * library is needed for one zone and one question.
 */
const TEHRAN_DAY = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Tehran',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

/**
 * Today's date in Tehran, as the **local midnight** of that day — the shape the app's datepickers
 * write and `toIsoCalendarDate` / `JalaliMonth` read. Call it when the answer is needed; a page left
 * open across midnight would otherwise keep yesterday.
 */
export const tehranToday = (now: Date = new Date()): Date => {
  const part = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(TEHRAN_DAY.formatToParts(now).find((candidate) => candidate.type === type)?.value);
  return new Date(part('year'), part('month') - 1, part('day'));
};
