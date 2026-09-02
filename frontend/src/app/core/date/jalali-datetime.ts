/**
 * Converts between the Jalali (Persian/Shamsi) calendar and a Gregorian `Date` — the app is a
 * Persian-language product (`../../../../CLAUDE.md`'s "Cablan is a Persian-language product"), so
 * the one date-range control it has (`features/boms`'s "تاریخ و زمان ثبت" filter) reads and
 * writes Jalali text directly rather than a Gregorian one, while the backend's `registeredAtFrom`/
 * `registeredAtTo` stay plain ISO instants.
 *
 * The conversion algorithm (`jalCal`/`g2d`/`d2g` below) is the well-known one behind the
 * `jalaali-js` package (MIT), reproduced here rather than pulled in as a dependency — this project
 * has no existing date-library dependency to build on, and a `package.json` change means a
 * regenerated `package-lock.json` (a guarded, generated file — see `../../../../CLAUDE.md`'s
 * "Generated files are guarded") for one small, pure, unit-verified function. The
 * `acceptance-tests` project's own `screenplay/common/jalali-datetime.ts` reproduces the identical
 * algorithm for the identical reason; this module is that project's independent frontend twin, not
 * a shared dependency between them (the monorepo's own "dependency runs one way" rule forbids the
 * two importing from each other).
 *
 * Verified by hand against the well-known fact that Nowruz 1403 fell on 20 March 2024:
 * `jalaaliToGregorian(1403, 1, 1)` returns `{ gy: 2024, gm: 3, gd: 20 }`.
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
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394,
    2456, 3178,
  ];
  const bl = breaks.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = breaks[0];
  let jump = 0;

  for (let i = 1; i < bl; i += 1) {
    const jm = breaks[i];
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

/** Gregorian calendar date to Julian day number, the other direction `g2d` needs for `dateToJalali`. */
const jalCalFromGregorian = (gy: number): { jy: number; march: number } => {
  // A Jalali year's Farvardin 1 falls in Gregorian March of that same year or the one before it, so
  // trying both and keeping the one whose `march` boundary the Gregorian date has already passed is
  // enough — the calendar has no leap-cycle ambiguity at this resolution.
  let jy = gy - 621;
  let r = jalCal(jy + 1);
  if (g2d(r.gy, 3, r.march) <= g2d(gy, 12, 31)) {
    jy += 1;
    r = jalCal(jy);
  } else {
    r = jalCal(jy);
  }
  return { jy, march: r.march };
};

const jalaaliToGregorian = (
  jy: number,
  jm: number,
  jd: number,
): { gy: number; gm: number; gd: number } => {
  const r = jalCal(jy);
  const jdn = g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
  return d2g(jdn);
};

const gregorianToJalaali = (
  gy: number,
  gm: number,
  gd: number,
): { jy: number; jm: number; jd: number } => {
  const jdn = g2d(gy, gm, gd);
  // `jalCalFromGregorian` gives an approximate Jalali year; walk from its March boundary to get the
  // exact day-of-year, then split that into month/day using the same 31/30-day rule `jalaaliToGregorian`
  // encodes in reverse.
  const { jy: approxJy } = jalCalFromGregorian(gy);
  let jy = approxJy;
  let r = jalCal(jy);
  let dayOfYear = jdn - g2d(r.gy, 3, r.march);
  if (dayOfYear < 0) {
    jy -= 1;
    r = jalCal(jy);
    dayOfYear = jdn - g2d(r.gy, 3, r.march);
  }

  const jm = dayOfYear < 186 ? 1 + div(dayOfYear, 31) : 7 + div(dayOfYear - 186, 30);
  const jd = 1 + (dayOfYear < 186 ? mod(dayOfYear, 31) : mod(dayOfYear - 186, 30));

  return { jy, jm, jd };
};

const JALALI_DATETIME_PATTERN = /^(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?$/;

/**
 * Parses a `"1403/04/01 08:30"` (or bare `"1403/04/01"`, defaulting to midnight) Jalali date/time
 * into a Gregorian `Date`, or `undefined` if `text` isn't one — a validator-friendly shape, so
 * callers never have to wrap this in a `try`/`catch` just to render a `<mat-error>`.
 *
 * ASSUMPTION: the time-of-day is interpreted as UTC, the same assumption
 * `acceptance-tests/screenplay/common/jalali-datetime.ts` makes and for the same reason — nothing
 * else in this app has an established timezone convention to follow instead.
 */
export const parseJalaliDateTime = (text: string): Date | undefined => {
  const match = JALALI_DATETIME_PATTERN.exec(text.trim());
  if (!match) {
    return undefined;
  }
  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = hourText ? Number(hourText) : 0;
  const minute = minuteText ? Number(minuteText) : 0;
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) {
    return undefined;
  }

  const { gy, gm, gd } = jalaaliToGregorian(Number(yearText), month, day);
  return new Date(Date.UTC(gy, gm - 1, gd, hour, minute, 0, 0));
};

const pad = (value: number): string => value.toString().padStart(2, '0');

/** The inverse of `parseJalaliDateTime` — renders a Gregorian instant as the Jalali text an operator
 * would type, `"YYYY/MM/DD HH:mm"`. */
export const formatJalaliDateTime = (date: Date): string => {
  const { jy, jm, jd } = gregorianToJalaali(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );
  return `${jy}/${pad(jm)}/${pad(jd)} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
};
