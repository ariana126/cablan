import { equals } from '@serenity-js/assertions';
import { By, PageElement, PageElements, Text } from '@serenity-js/web';

/**
 * The three names one `app-jalali-datetime-field` is addressed by: its date textbox's label, its
 * time combobox's label, and the *bound name* its three buttons carry («باز کردن تقویم {bound}»,
 * «انتخاب ساعت {bound}», «اکنون برای {bound}»). The bound name is deliberately a different word
 * from either label, so a locator asking for the label never also matches a button.
 */
export interface JalaliDateTimeFieldNames {
  readonly dateLabel: string;
  readonly timeLabel: string;
  readonly boundName: string;
}

/**
 * Lean Page Object for the shared date-and-time control (`app-jalali-datetime-field`) every
 * date-range filter in the app is built from — the daily-BOM report's and the dashboard's. Each
 * page object hands out one per bound (`BomReportsPage.registeredAtFrom()`, …), and the domain
 * layer's `screenplay/common/pick-jalali-date-time.ts` is what drives it. Locates elements and
 * reports what they say — nothing else.
 *
 * Both inputs are `readonly`: a value is set through Material's datepicker (a Jalali calendar,
 * through the app's `DateAdapter`) and timepicker (a listbox of times every 15 minutes), never by
 * typing.
 *
 * ASSUMPTION — every name below was derived from source, not yet seen in a rendered page: the
 * component (`ui/jalali-datetime-field`), `PersianDatepickerIntl`, the Jalali `DateAdapter`'s
 * formats, `ngx-material-date-fns-adapter@21.0.0`, `date-fns-jalali@4.1.0-0`'s `faIR` locale and
 * Material 21's calendar/timepicker templates. A locator timing out here is the first thing to
 * check against the screenshot in the living documentation.
 * - The calendar popup is a `role="dialog"` named after the **date input's label**, and the
 *   timepicker's popup a `role="listbox"` named after the **time input's label** — so every cell
 *   and option below is scoped to the popup that belongs to this one field.
 * - The pickers are opened through their toggle buttons, by bound name — a name the component
 *   fixes and its own spec asserts. Clicking the input opens them too, but in an empty outlined
 *   field the floating `mat-label` sits over the box and may take the click instead.
 * - Year and month cells are named in **Latin** digits — `1403`, `تیر 1403` (the adapter's
 *   `monthYearA11yLabel`). Day cells print their number in Persian digits (`۱`) and are found by
 *   that; see `dayCell` for why not by name. None of this wording is gated by
 *   `make lint-accessibility`, only the names' presence is.
 * - Time options are named `HH:mm`, 24-hour, Latin digits (`08:30`).
 * - The month view's period button is named «انتخاب ماه و سال» (`PersianDatepickerIntl`), and the
 *   multi-year view pages with «بازه سال‌های قبل» / «بازه سال‌های بعد».
 */
export const JalaliDateTimeField = {
  labelled: (names: JalaliDateTimeFieldNames) => {
    const calendar = () =>
      PageElement.located(
        By.role('dialog', { name: names.dateLabel, exact: true }),
      ).describedAs(`calendar of "${names.dateLabel}"`);

    const calendarButton = (name: string, description: string) =>
      PageElement.located(By.role('button', { name, exact: true }))
        .of(calendar())
        .describedAs(description);

    const clock = () =>
      PageElement.located(
        By.role('listbox', { name: names.timeLabel, exact: true }),
      ).describedAs(`time options of "${names.timeLabel}"`);

    return {
      names,

      dateInput: () =>
        PageElement.located(
          By.role('textbox', { name: names.dateLabel, exact: true }),
        ).describedAs(`"${names.dateLabel}" field`),

      timeInput: () =>
        PageElement.located(
          By.role('combobox', { name: names.timeLabel, exact: true }),
        ).describedAs(`"${names.timeLabel}" field`),

      openCalendarButton: () =>
        PageElement.located(
          By.role('button', {
            name: `باز کردن تقویم ${names.boundName}`,
            exact: true,
          }),
        ).describedAs(`"${names.dateLabel}" calendar toggle`),

      openClockButton: () =>
        PageElement.located(
          By.role('button', {
            name: `انتخاب ساعت ${names.boundName}`,
            exact: true,
          }),
        ).describedAs(`"${names.timeLabel}" clock toggle`),

      calendar,

      /** The month view's period button — leads to the multi-year view. */
      chooseMonthAndYearButton: () =>
        calendarButton('انتخاب ماه و سال', 'choose month and year button'),

      previousYearsButton: () =>
        calendarButton('بازه سال‌های قبل', 'previous years button'),

      nextYearsButton: () =>
        calendarButton('بازه سال‌های بعد', 'next years button'),

      /** Every year cell the multi-year view currently shows (24 at a time), in rendered order. */
      yearCells: () =>
        PageElements.located(By.css('[role="gridcell"] button'))
          .of(calendar())
          .describedAs('year cells'),

      /** `year` in Latin digits, e.g. `1403`. */
      yearCell: (year: string) => calendarButton(year, `year ${year}`),

      /** `monthName` as the Jalali calendar spells it in full, e.g. `تیر`. */
      monthCell: (monthName: string, year: string) =>
        calendarButton(`${monthName} ${year}`, `month ${monthName} ${year}`),

      /**
       * One day of the month the calendar is showing, found by the number it prints (`۱`, `۱۵`) —
       * not by its accessible name, which spells the month with date-fns' *abbreviation*
       * (`1 مرد 1403` for مرداد, while the month and header cells read `مرداد 1403`), so it cannot be
       * predicted from the month's name. The month view only ever shows its own month's days, so
       * the number alone is unambiguous once `monthCell` has been clicked.
       */
      dayCell: (dayAsPrinted: string) =>
        PageElements.located(By.css('[role="gridcell"] button'))
          .of(calendar())
          .where(Text, equals(dayAsPrinted))
          .first()
          .describedAs(`day ${dayAsPrinted}`),

      clock,

      /** `time` as `HH:mm`, e.g. `08:30`. */
      timeOption: (time: string) =>
        PageElement.located(By.role('option', { name: time, exact: true }))
          .of(clock())
          .describedAs(`time option ${time}`),
    };
  },
};

export type JalaliDateTimeFieldElements = ReturnType<
  typeof JalaliDateTimeField.labelled
>;
