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
 * Neither bound can hold unreadable text: the fields take no typing (issue #52), so a bound is
 * always either a picked instant or `null`. That is why the schema below has only the ordering rule
 * — it once also carried a sibling "unparseable" flag per bound, needed only while text could be
 * typed, because signal forms never reads a control accessor's own `matDatepickerParse` error.
 */
export interface DateRangeFormModel {
  readonly from: Date | null;
  readonly to: Date | null;
}

/** An unset range: both bounds open. Every page starts here and returns here on "clear". */
export const EMPTY_DATE_RANGE: DateRangeFormModel = { from: null, to: null };

/** A range with both bounds set — what a preset produces, replacing whatever was picked. */
export const appliedDateRange = (from: Date, to: Date): DateRangeFormModel => ({ from, to });

const UNORDERED_RANGE_ERROR = {
  kind: 'unorderedDateRange',
  message: 'پایان بازه نباید پیش از آغاز آن باشد.',
};

/**
 * The one rule a range needs: its two bounds are the right way round.
 *
 * The ordering check hangs off `to` rather than `from` so the error renders under the field the
 * operator most likely just set, and so a range with only a lower bound never shows one.
 */
export const dateRangeSchema = schema<DateRangeFormModel>((path) => {
  validate(path.to, ({ value, valueOf }) => {
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
