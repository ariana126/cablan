import { d, Interaction, Task, Wait } from '@serenity-js/core';
import { Click, isVisible, Text } from '@serenity-js/web';
import { isPresent, not } from '@serenity-js/assertions';
import { JalaliDateTimeFieldElements } from '../ui/jalali-datetime-field';
import { fromRenderedNumber, toPersianDigits } from './persian-digits';

/** The Jalali months, as the calendar spells them in its cells' accessible names. */
const JALALI_MONTH_NAMES = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

/** The timepicker offers a time every 15 minutes, and nothing in between. */
const TIME_INTERVAL_MINUTES = 15;

/** How many 24-year pages the multi-year view may be turned before giving up. */
const MAX_YEAR_PAGES = 10;

const JALALI_DATETIME_TEXT =
  /^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})$/;

interface JalaliDateTimeParts {
  readonly year: string;
  readonly monthName: string;
  readonly day: string;
  readonly time: string;
}

/** `"1403/04/01 08:30"` → the names the calendar and the clock use for that instant. */
const partsOf = (text: string): JalaliDateTimeParts => {
  const match = JALALI_DATETIME_TEXT.exec(text.trim());
  if (!match) {
    throw new Error(
      `"${text}" is not a Jalali date and time — expected "YYYY/MM/DD HH:mm".`,
    );
  }
  const [, year, month, day, hour, minute] = match;
  const monthName = JALALI_MONTH_NAMES[Number(month) - 1];
  if (!monthName) {
    throw new Error(`"${text}" names no Jalali month (${month}).`);
  }
  if (Number(minute) % TIME_INTERVAL_MINUTES !== 0) {
    throw new Error(
      `"${text}" cannot be picked: the timepicker offers only times every ` +
        `${TIME_INTERVAL_MINUTES} minutes.`,
    );
  }
  return {
    year,
    monthName,
    day: String(Number(day)),
    time: `${hour.padStart(2, '0')}:${minute}`,
  };
};

/**
 * Turns the multi-year view's 24-year pages until `year` is on the one showing — the calendar opens
 * on the browser's "today" (or on the field's current value), which may be any distance from the
 * year a scenario wants.
 *
 * The page count is worked out once, from the years showing when the view opens, and then that many
 * clicks are made back to back — rather than re-reading the cells after every click. Material's
 * previous/next handlers move the calendar's active date by a whole page from its own state, so N
 * clicks land N pages away however far the re-render lags behind; re-reading after each click could
 * see the page *before* the click had rendered and turn one too many.
 */
const TurnToTheYear = (field: JalaliDateTimeFieldElements, year: string) =>
  Interaction.where(d`#actor turns the calendar to ${year}`, async (actor) => {
    const wanted = Number(year);
    const shown = (await actor.answer(Text.ofAll(field.yearCells())))
      .map((text) => Number(fromRenderedNumber(text)))
      .filter((shownYear) => Number.isInteger(shownYear));
    if (shown.length === 0) {
      throw new Error('The calendar shows no years to turn from.');
    }
    const first = Math.min(...shown);
    const last = Math.max(...shown);
    const pageSize = shown.length;
    const pages =
      wanted < first
        ? Math.ceil((first - wanted) / pageSize)
        : wanted > last
          ? Math.ceil((wanted - last) / pageSize)
          : 0;
    if (pages > MAX_YEAR_PAGES) {
      throw new Error(
        `The year ${year} is ${pages} pages from the calendar's ${first}–${last}; ` +
          `more than ${MAX_YEAR_PAGES} is taken to mean a malformed year.`,
      );
    }
    const turn =
      wanted < first ? field.previousYearsButton() : field.nextYearsButton();
    for (let page = 0; page < pages; page += 1) {
      await Click.on(turn).performAs(actor);
    }
  });

/**
 * Opens the calendar, walks multi-year → year → month, and clicks the day. Picking a date sets the
 * time of day to midnight, which is why `PickJalaliDateTime` picks the time second.
 *
 * The cells and options are waited for with `isPresent()`, not `isVisible()`: Serenity's
 * `isVisible` is a hit test at the element's centre, which fails for a time option scrolled out of
 * the listbox and for a calendar cell the overlay pushes past the viewport's edge — both of which
 * the following `Click` scrolls into view by itself.
 */
const PickJalaliDate = (
  field: JalaliDateTimeFieldElements,
  { year, monthName, day }: JalaliDateTimeParts,
): Task =>
  Task.where(
    d`#actor picks ${day} ${monthName} ${year} from the calendar of "${field.names.dateLabel}"`,
    Click.on(field.openCalendarButton()),
    Wait.until(field.chooseMonthAndYearButton(), isVisible()),
    Click.on(field.chooseMonthAndYearButton()),
    Wait.until(field.previousYearsButton(), isVisible()),
    TurnToTheYear(field, year),
    Wait.until(field.yearCell(year), isPresent()),
    Click.on(field.yearCell(year)),
    Wait.until(field.monthCell(monthName, year), isPresent()),
    Click.on(field.monthCell(monthName, year)),
    Wait.until(field.dayCell(toPersianDigits(day)), isPresent()),
    Click.on(field.dayCell(toPersianDigits(day))),
    Wait.until(field.calendar(), not(isVisible())),
  );

const PickTimeOfDay = (
  field: JalaliDateTimeFieldElements,
  { time }: JalaliDateTimeParts,
): Task =>
  Task.where(
    d`#actor picks ${time} from the clock of "${field.names.timeLabel}"`,
    Click.on(field.openClockButton()),
    Wait.until(field.timeOption(time), isPresent()),
    Click.on(field.timeOption(time)),
    Wait.until(field.clock(), not(isVisible())),
  );

/**
 * Sets one `app-jalali-datetime-field` to a Gherkin's Jalali `"YYYY/MM/DD HH:mm"` the way a person
 * has to — the two inputs are read-only, so the date comes from the calendar and the time from the
 * clock's list (which offers only quarter hours; anything else is rejected up front rather than
 * left to time out). The page decides which field: its Lean Page Object hands out the
 * `JalaliDateTimeField` for each bound.
 */
export const PickJalaliDateTime = {
  of: (text: string) => ({
    in: (field: JalaliDateTimeFieldElements): Task => {
      const parts = partsOf(text);
      return Task.where(
        d`#actor picks ${text} in "${field.names.boundName}"`,
        PickJalaliDate(field, parts),
        PickTimeOfDay(field, parts),
      );
    },
  }),
};
