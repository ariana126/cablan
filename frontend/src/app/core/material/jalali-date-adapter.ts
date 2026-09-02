import { Provider } from '@angular/core';
import { MAT_DATE_LOCALE, MatDateFormats } from '@angular/material/core';
import { MatDatepickerIntl } from '@angular/material/datepicker';
import { faIR } from 'date-fns/locale';
import { provideDateFnsAdapter } from 'ngx-material-date-fns-adapter';

import { PersianDatepickerIntl } from './persian-datepicker-intl';

/**
 * The formats `mat-datepicker` and `mat-timepicker` parse and display Jalali values with.
 *
 * `ngx-material-date-fns-adapter` defaults every one of these to a *localised* `date-fns` token
 * (`P` for a date, `p` for a time), and for `fa-IR` that resolves `p` to a **twelve-hour** clock —
 * `8:30 ق.ظ.`. Nothing else in this app writes a time that way: `core/date/jalali-datetime.ts`,
 * the report tables and `features/boms/bom-report-export.ts` are all 24-hour, and so is ordinary
 * Iranian usage. Left at the default, the picker would hand back a time the operator could not type
 * and the export would not match.
 *
 * So the four formats that decide what a person reads and types are pinned explicitly, and the
 * three that only label the calendar's own chrome keep the adapter's defaults —
 * `monthYearLabel: 'LLL uuuu'` in particular is load-bearing, because the adapter special-cases that
 * exact string (and bare `'LLL'`) to widen Persian month names from their unreadable abbreviations.
 * Changing it to `'LLLL uuuu'` would look identical and quietly bypass that fix.
 */
export const JALALI_DATE_FORMATS: MatDateFormats = {
  parse: {
    dateInput: 'yyyy/MM/dd',
    timeInput: 'HH:mm',
  },
  display: {
    dateInput: 'yyyy/MM/dd',
    timeInput: 'HH:mm',
    timeOptionLabel: 'HH:mm',
    monthYearLabel: 'LLL uuuu',
    dateA11yLabel: 'PP',
    monthYearA11yLabel: 'LLLL uuuu',
  },
};

/**
 * Everything that makes Material's date and time pickers Persian: a Jalali calendar, a 24-hour
 * clock, and Persian labels on the controls that carry no visible text.
 *
 * `ngx-material-date-fns-adapter` implements Material's `DateAdapter` over `date-fns-jalali` and
 * switches to the Jalali calendar internally when the locale's code is `fa-IR` — which is why the
 * locale below is the ordinary `date-fns` one and not a Jalali-specific import. `mat-datepicker`
 * and `mat-timepicker` read the same adapter, so this one call configures both.
 *
 * It is a function rather than an array so that `app.config.ts` and every spec rendering a date
 * field apply the identical set; a spec that assembled its own would be free to drift from the app
 * it is meant to be testing.
 */
export const provideJalaliDateAdapter = (): Provider[] => [
  provideDateFnsAdapter(JALALI_DATE_FORMATS),
  { provide: MAT_DATE_LOCALE, useValue: faIR },
  { provide: MatDatepickerIntl, useClass: PersianDatepickerIntl },
];
