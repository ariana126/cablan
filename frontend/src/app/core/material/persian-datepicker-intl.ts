import { Injectable } from '@angular/core';
import { MatDatepickerIntl } from '@angular/material/datepicker';

/**
 * `mat-datepicker` ships English labels ("Open calendar", "Next month", …) and they are not
 * decorative: every one of them is an `aria-label` or an announcement on a control that carries no
 * visible text, so leaving them English hands a Persian screen-reader user an English calendar.
 * `make lint-accessibility` grades the rendered markup, and an accessible name in the wrong
 * language is exactly the kind of thing it cannot see — see `../../../CLAUDE.md`'s "The part no
 * tool checks".
 *
 * Registered once in `app.config.ts` beside `PersianPaginatorIntl`, for the same reason that one is:
 * any later date field inherits these with no per-component wiring.
 *
 * Note there is no `MatTimepickerIntl` to match — `mat-timepicker`'s toggle takes a plain
 * `aria-label` input instead, which `ui/jalali-datetime-field` supplies.
 */
@Injectable()
export class PersianDatepickerIntl extends MatDatepickerIntl {
  override calendarLabel = 'تقویم';
  override openCalendarLabel = 'باز کردن تقویم';
  override closeCalendarLabel = 'بستن تقویم';
  override prevMonthLabel = 'ماه قبل';
  override nextMonthLabel = 'ماه بعد';
  override prevYearLabel = 'سال قبل';
  override nextYearLabel = 'سال بعد';
  override prevMultiYearLabel = 'بازه سال‌های قبل';
  override nextMultiYearLabel = 'بازه سال‌های بعد';
  override switchToMonthViewLabel = 'نمایش تقویم ماه';
  override switchToMultiYearViewLabel = 'انتخاب ماه و سال';
  override startDateLabel = 'تاریخ شروع';
  override endDateLabel = 'تاریخ پایان';
  override comparisonDateLabel = 'بازه مقایسه';

  override formatYearRange(start: string, end: string): string {
    return `${start} تا ${end}`;
  }

  override formatYearRangeLabel(start: string, end: string): string {
    return `سال‌های ${start} تا ${end}`;
  }
}
