import { schema, validate } from '@angular/forms/signals';

/**
 * The shape every date-range filter in the app binds to — `features/boms`, `features/audit-log` and
 * `features/bom-dashboard` all ask the same "between when and when?" question, and answering it
 * three slightly different ways is how they would drift.
 *
 * The bounds are `Date`, not the Jalali text they used to be: `ui/jalali-datetime-field` puts
 * Material's datepicker and timepicker on them, and those write a `Date` or `null` through their own
 * value accessor.
 *
 * **Why the two `…Unparseable` flags are part of the model.** Material reports unreadable text as a
 * `matDatepickerParse` error through `NG_VALIDATORS`, and signal forms' `cvaControlCreate` bridges
 * only `registerOnChange` and `registerOnTouched` — it never reads `NG_VALIDATORS`. So a control
 * accessor's own validation errors are invisible to `FieldState.errors()`, and typing nonsense into
 * a date field would leave the model holding `null`, the form reporting itself valid, and the filter
 * quietly applying with that bound missing. Writing an invalid `Date` into the field instead is not
 * an option either: signal forms pushes the new value straight back through `writeValue`, and
 * `MatDatepickerInput` renders an invalid date as an empty string, erasing what the operator typed.
 *
 * Carrying the flag as a sibling field is what is left, and it is honest about what it is — form
 * state that decides validity, set by the control and read by the schema below, so `submit()` blocks
 * exactly as it did when these pages parsed the text themselves.
 */
export interface DateRangeFormModel {
  readonly from: Date | null;
  readonly to: Date | null;
  readonly fromUnparseable: boolean;
  readonly toUnparseable: boolean;
}

/** An unset range: both bounds open, neither field holding text that failed to parse. Every page
 * starts here and returns here on "clear". */
export const EMPTY_DATE_RANGE: DateRangeFormModel = {
  from: null,
  to: null,
  fromUnparseable: false,
  toUnparseable: false,
};

/** A range with both bounds set — what a preset produces, and what a page spreads over
 * `EMPTY_DATE_RANGE` to replace whatever was typed. */
export const appliedDateRange = (from: Date, to: Date): DateRangeFormModel => ({
  ...EMPTY_DATE_RANGE,
  from,
  to,
});

const JALALI_FORMAT_ERROR = {
  kind: 'invalidJalaliDateTime',
  message: 'قالب تاریخ و زمان معتبر نیست. نمونه: 1403/04/01 08:30',
};

const UNORDERED_RANGE_ERROR = {
  kind: 'unorderedDateRange',
  message: 'پایان بازه نباید پیش از آغاز آن باشد.',
};

/**
 * The two rules a range needs: each bound is either a real instant or nothing at all, and the two
 * are the right way round.
 *
 * The ordering check hangs off `to` rather than `from` so the error renders under the field the
 * operator most likely just set, and so a range with only a lower bound never shows one.
 */
export const dateRangeSchema = schema<DateRangeFormModel>((path) => {
  validate(path.from, ({ valueOf }) =>
    valueOf(path.fromUnparseable) ? JALALI_FORMAT_ERROR : undefined,
  );

  validate(path.to, ({ value, valueOf }) => {
    if (valueOf(path.toUnparseable)) {
      return JALALI_FORMAT_ERROR;
    }

    const to = value();
    const from = valueOf(path.from);
    return from !== null && to !== null && to.getTime() < from.getTime()
      ? UNORDERED_RANGE_ERROR
      : undefined;
  });
});

/** The range as the API takes it: ISO instants, with an open bound left off the request entirely
 * rather than sent as `null`. */
export const toIsoDateRange = (
  range: DateRangeFormModel,
): { from: string | undefined; to: string | undefined } => ({
  from: range.from === null ? undefined : range.from.toISOString(),
  to: range.to === null ? undefined : range.to.toISOString(),
});
