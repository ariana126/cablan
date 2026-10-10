import { SchemaPath, validate } from '@angular/forms/signals';

/** True for any finite number strictly greater than zero — `0.1` is positive, `0`, negatives, `NaN`
 * and `Infinity` are not. */
export const isPositiveNumber = (value: number): boolean => Number.isFinite(value) && value > 0;

/**
 * "Must be a positive number" for a number field — the one rule every quantity input in the app
 * (weights, lengths) shares, so none of them can quietly draw the line somewhere else.
 *
 * **Why not `min(path, 1)`.** `min` is inclusive, so it can only say "at least N"; using `1` for
 * "positive" silently rejected every value between 0 and 1 (`0.1` kg is a perfectly good weight).
 * Strictly-greater-than-zero cannot be expressed as an inclusive bound, hence a `validate`.
 *
 * Pair it with a `step="any"` on the input, otherwise the browser's own constraint validation
 * treats a fractional value as a step mismatch.
 */
export function positiveNumber(path: SchemaPath<number>, options: { message: string }): void {
  validate(path, ({ value }) =>
    isPositiveNumber(value()) ? undefined : { kind: 'positiveNumber', message: options.message },
  );
}
