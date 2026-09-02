import { Pipe, PipeTransform } from '@angular/core';

import { formatPersianNumber } from '../../core/i18n/persian-numerals';

/**
 * `{{ row.weight | persianNumber }}` — a quantity, rendered the way Persian writes one.
 *
 * A pipe rather than a method on each page, because the same handful of table cells and definition
 * lists appear on six pages and none of them should be free to render a number differently. Pure by
 * default, so a table redraw costs one memoised call per distinct value.
 *
 * Only for **quantities**: weights, lengths, counts, scores. Codes and identifiers keep Latin digits
 * — see `core/i18n/persian-numerals.ts` for why — and a pre-formatted string such as a Jalali date
 * wants `toPersianDigits`, not this, or `1403` would be regrouped into `۱٬۴۰۳`.
 */
@Pipe({ name: 'persianNumber' })
export class PersianNumberPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return value === null || value === undefined ? '' : formatPersianNumber(value);
  }
}
