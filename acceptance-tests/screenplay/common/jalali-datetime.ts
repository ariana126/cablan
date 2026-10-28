/**
 * Converts a Jalali (Persian/Shamsi) calendar date/time — the calendar every `.feature` file in
 * this suite writes dates in, per `CLAUDE.md`'s "Cablan is a Persian-language product" — into a
 * Gregorian `Date`, so it can be handed to the backend's test clock
 * (`screenplay/common/clock.ts#FreezeTimeAt`, which posts a plain ISO string).
 *
 * Only this one direction is needed: nothing in this suite ever has to render a Gregorian instant
 * back as Jalali text, since every UI-facing comparison works against the *same* literal Jalali
 * string a `.feature` file already wrote — the Excel-style filter checkboxes by that text, the
 * date-range pickers by the year, month and day it names
 * (`screenplay/common/pick-jalali-date-time.ts`) — rather than converting it at all.
 *
 * The conversion algorithm (`jalCal`/`g2d`/`d2g` below) is the well-known one behind the `jalaali-js`
 * package (MIT), reproduced here rather than pulled in as a dependency: this suite has no existing
 * date-library dependency to build on, and a `package.json` change means a regenerated
 * `package-lock.json` — a guarded, generated file (`acceptance-tests/CLAUDE.md`'s "Generated files
 * are guarded") — which isn't warranted for one small, pure, unit-verifiable function. Verified by
 * hand against the well-known fact that Nowruz 1403 fell on 20 March 2024: `jalaaliToGregorian(1403,
 * 1, 1)` returns `{ gy: 2024, gm: 3, gd: 20 }`, and every date this suite's own background tables use
 * (1403/04/01, 1403/04/05, 1403/05/01, and the range boundaries 1403/04/01, 1403/04/06) checks out
 * against manual day-arithmetic from that anchor.
 */

const div = (a: number, b: number): number => Math.trunc(a / b);
const mod = (a: number, b: number): number => a - div(a, b) * b;

interface JalCalResult {
  leap: number;
  gy: number;
  march: number;
}

/** Works out, for a given Jalali year, which Gregorian year Farvardin 1 falls in and on which day
 * of March — the non-uniform 33-year leap-year cycle is what makes this more than simple
 * arithmetic. */
const jalCal = (jy: number): JalCalResult => {
  const breaks = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097,
    2192, 2262, 2324, 2394, 2456, 3178,
  ];
  const bl = breaks.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = breaks[0];
  let jm = jp;
  let jump = 0;

  if (jy < jp || jy >= breaks[bl - 1]) {
    throw new Error(`Invalid Jalaali year ${jy}`);
  }

  for (let i = 1; i < bl; i += 1) {
    jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) {
      break;
    }
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  const n = jy - jp;

  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) {
    leapJ += 1;
  }

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;

  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) {
    leap = 4;
  }

  return { leap, gy, march };
};

/** Gregorian calendar date to Julian day number. */
const g2d = (gy: number, gm: number, gd: number): number => {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
};

/** Julian day number to Gregorian calendar date. */
const d2g = (jdn: number): { gy: number; gm: number; gd: number } => {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
};

const jalaaliToGregorian = (
  jy: number,
  jm: number,
  jd: number,
): { gy: number; gm: number; gd: number } => {
  const r = jalCal(jy);
  const jdn =
    g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
  return d2g(jdn);
};

const JALALI_DATETIME_PATTERN =
  /^(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?$/;

/**
 * Parses a `"1403/04/01 08:30"` (or bare `"1403/04/01"`, defaulting to midnight) Jalali date/time
 * into a Gregorian `Date`.
 *
 * ASSUMPTION: the time-of-day is interpreted as UTC. There's no established timezone convention
 * anywhere else in this suite (`support/config.ts`, `screenplay/common/clock.ts` — every instant
 * they handle is already a plain ISO string) to follow instead, and every scenario this parses for
 * only ever compares instants it produced *itself* (registration order, range boundaries) against
 * each other, never against a real-world wall clock — so a consistent, arbitrary interpretation is
 * all correctness actually requires.
 */
export const parseJalaliDateTime = (text: string): Date => {
  const match = JALALI_DATETIME_PATTERN.exec(text.trim());
  if (!match) {
    throw new Error(
      `"${text}" is not a recognised Jalali date/time — expected "YYYY/MM/DD" or ` +
        '"YYYY/MM/DD HH:mm".',
    );
  }
  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const { gy, gm, gd } = jalaaliToGregorian(
    Number(yearText),
    Number(monthText),
    Number(dayText),
  );
  const hour = hourText ? Number(hourText) : 0;
  const minute = minuteText ? Number(minuteText) : 0;
  return new Date(Date.UTC(gy, gm - 1, gd, hour, minute, 0, 0));
};

/** Asia/Tehran's offset from UTC. Iran abolished daylight saving time in 2022, so it is a constant
 * +03:30 for every instant this suite freezes at. */
const TEHRAN_OFFSET_MILLISECONDS = (3 * 60 + 30) * 60 * 1000;

/**
 * The instant a Jalali date and an `HH:mm` wall-clock time name **in Asia/Tehran** — what
 * «اکنون «1403/06/15» ساعت «10:00» باشد» means (`2024-09-05T06:30:00.000Z`).
 *
 * Unlike `parseJalaliDateTime` above, the zone is not arbitrary here: the backend renders a daily
 * BOM's edit heading («کاربر … در 1403/06/15 ساعت 10:00 …») in Asia/Tehran, and the Gherkin states
 * that rendered text, so the suite must freeze the clock at the instant that renders as it.
 */
export const tehranWallClockInstant = (date: string, time: string): Date =>
  new Date(
    parseJalaliDateTime(`${date} ${time}`).getTime() -
      TEHRAN_OFFSET_MILLISECONDS,
  );
