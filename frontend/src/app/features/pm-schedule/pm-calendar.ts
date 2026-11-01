import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import { getDate } from 'date-fns-jalali';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';

import { formatJalaliCalendarDate, toIsoCalendarDate } from '../../core/date/calendar-date';
import { JalaliMonth } from '../../core/date/jalali-month';
import { formatPersianNumber } from '../../core/i18n/persian-numerals';
import { AppPmOccurrence } from '../../core/maintenance/pm-schedule-gateway';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { Icon } from '../../ui/icon/icon';
import { PmDayOccurrencesDialog, PmDayOccurrencesDialogData } from './pm-day-occurrences-dialog';
import { PmOccurrenceChip } from './pm-occurrence-chip';
import {
  PmOccurrenceDetailsDialog,
  PmOccurrenceDetailsDialogData,
} from './pm-occurrence-details-dialog';

/** The Persian week, Saturday first — the order the grid's columns run in, from the start edge. */
const WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

/** How many of a day's occurrences its cell shows before «+N مورد دیگر». */
const CHIPS_PER_DAY = 3;

/** Why the month could not be shown, if it could not. */
export type PmCalendarFailure = 'forbidden' | 'error';

interface CalendarCell {
  readonly key: string;
  readonly inMonth: boolean;
  /** «۱۴۰۵/۰۸/۰۳» — the cell's accessible name. */
  readonly label: string;
  readonly dayNumber: string;
  readonly weekday: string;
  readonly today: boolean;
  readonly occurrences: readonly AppPmOccurrence[];
  readonly shown: readonly AppPmOccurrence[];
  /** «+۲ مورد دیگر», or `null` when every occurrence of the day is shown. */
  readonly more: string | null;
}

/**
 * The PM schedule as a Jalali month (issue #90): Saturday first, laid out from the start edge, so the
 * week reads right to left. One `<section>` region named «تقویم PM», holding the month's title as
 * its only `<h2>`, «ماه قبل» / «امروز» / «ماه بعد», and the days.
 *
 * **Every day of the month is a `role="group"` named by its Jalali date** («۱۴۰۵/۰۸/۰۳»), holding
 * its first three occurrences as chips and, beyond three, a «+N مورد دیگر» button that lists the day
 * in full. The days padding the first and last weeks belong to the neighbouring months: they are
 * drawn muted and hidden from assistive technology, with neither the role nor the name, so they are
 * never counted as days of this month. An occurrence sits on its `calendarDate` — the day it was done
 * when it was done late, else its due date — which the API computes.
 *
 * Material has no month grid with content in its days (`mat-calendar` is a date picker), so this is
 * built from tokens alone. Below 40rem of its own width (a phone held upright) the grid becomes one
 * column — a day per row, each with its weekday — and the padding days drop out.
 *
 * Presentational: the page owns the month (`model`), reads it and passes the rows in.
 */
@Component({
  selector: 'app-pm-calendar',
  imports: [ErrorBanner, Icon, MatButton, MatIcon, MatProgressBar, PmOccurrenceChip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="pm-calendar" aria-label="تقویم PM">
      @if (loading()) {
        <mat-progress-bar
          class="pm-calendar__progress"
          mode="indeterminate"
          aria-label="در حال بارگذاری تقویم PM"
        />
      }

      <div class="pm-calendar__bar">
        <h2 class="pm-calendar__title" aria-live="polite">{{ month().title }}</h2>
        <div class="pm-calendar__nav">
          <button matButton="outlined" type="button" (click)="step(-1)">
            <mat-icon appIcon="previous" />ماه قبل
          </button>
          <button matButton type="button" (click)="showToday()">
            <mat-icon appIcon="calendar" />امروز
          </button>
          <button matButton="outlined" type="button" (click)="step(1)">
            <mat-icon appIcon="next" />ماه بعد
          </button>
        </div>
      </div>

      @if (failure() === 'forbidden') {
        <app-error-banner message="شما دسترسی لازم برای مشاهده این بخش را ندارید." />
      } @else if (failure() === 'error') {
        <app-error-banner
          message="برنامه PM بارگذاری نشد."
          retryLabel="تلاش دوباره"
          (retry)="retry.emit()"
        />
      } @else if (!loading() && occurrences().length === 0) {
        <p class="pm-calendar__empty">هیچ موعدی در این ماه یافت نشد.</p>
      }

      <div class="pm-calendar__month">
        <div class="pm-calendar__weekdays" aria-hidden="true">
          @for (weekday of weekdays; track weekday) {
            <span class="pm-calendar__weekday">{{ weekday }}</span>
          }
        </div>

        <div class="pm-calendar__grid">
          @for (cell of cells(); track cell.key) {
            @if (cell.inMonth) {
              <div
                class="pm-calendar__day"
                role="group"
                [class.pm-calendar__day--today]="cell.today"
                [attr.aria-label]="cell.label"
                [attr.aria-current]="cell.today ? 'date' : null"
              >
                <div class="pm-calendar__day-head" aria-hidden="true">
                  <span class="pm-calendar__day-number">{{ cell.dayNumber }}</span>
                  <span class="pm-calendar__day-weekday">{{ cell.weekday }}</span>
                  @if (cell.today) {
                    <span class="pm-calendar__today">امروز</span>
                  }
                </div>
                @for (occurrence of cell.shown; track $index) {
                  <app-pm-occurrence-chip
                    [occurrence]="occurrence"
                    (choose)="openDetails(occurrence)"
                  />
                }
                @if (cell.more; as more) {
                  <button class="pm-calendar__more" type="button" (click)="openDay(cell, $event)">
                    {{ more }}
                  </button>
                }
              </div>
            } @else {
              <div class="pm-calendar__day pm-calendar__day--outside" aria-hidden="true">
                <div class="pm-calendar__day-head">
                  <span class="pm-calendar__day-number">{{ cell.dayNumber }}</span>
                </div>
              </div>
            }
          }
        </div>
      </div>
    </section>
  `,
  styleUrl: './pm-calendar.scss',
})
export class PmCalendar {
  private readonly dialog = inject(MatDialog);

  readonly month = model.required<JalaliMonth>();
  /** The viewer's today, for «امروز» and the mark on its day. */
  readonly today = input.required<Date>();
  /** The month's occurrences, as the API ordered them; empty while loading. */
  readonly occurrences = input.required<readonly AppPmOccurrence[]>();
  readonly loading = input(false);
  readonly failure = input<PmCalendarFailure | null>(null);

  readonly retry = output<void>();

  protected readonly weekdays = WEEKDAYS;

  protected readonly cells = computed<CalendarCell[]>(() => {
    const todayKey = toIsoCalendarDate(this.today());
    const byDay = new Map<string, AppPmOccurrence[]>();
    for (const occurrence of this.occurrences()) {
      const day = byDay.get(occurrence.calendarDate) ?? [];
      day.push(occurrence);
      byDay.set(occurrence.calendarDate, day);
    }

    return this.month()
      .weeks()
      .flat()
      .map((day, index) => {
        const key = toIsoCalendarDate(day.date);
        const occurrences = day.inMonth ? (byDay.get(key) ?? []) : [];
        const hidden = occurrences.length - CHIPS_PER_DAY;
        return {
          key,
          inMonth: day.inMonth,
          label: formatJalaliCalendarDate(key),
          dayNumber: formatPersianNumber(getDate(day.date)),
          weekday: WEEKDAYS[index % WEEKDAYS.length],
          today: day.inMonth && key === todayKey,
          occurrences,
          shown: occurrences.slice(0, CHIPS_PER_DAY),
          more: hidden > 0 ? `+${formatPersianNumber(hidden)} مورد دیگر` : null,
        };
      });
  });

  protected step(months: number): void {
    this.month.update((month) => month.plus(months));
  }

  protected showToday(): void {
    this.month.set(JalaliMonth.containing(this.today()));
  }

  protected openDetails(occurrence: AppPmOccurrence, restoreFocus?: HTMLElement): void {
    this.dialog.open<PmOccurrenceDetailsDialog, PmOccurrenceDetailsDialogData>(
      PmOccurrenceDetailsDialog,
      { data: { occurrence }, ...(restoreFocus ? { restoreFocus } : {}) },
    );
  }

  protected openDay(cell: CalendarCell, event: Event): void {
    // The day's list closes before the details open, so focus has nowhere to return to by itself:
    // both go back to this button.
    const trigger = event.currentTarget as HTMLElement;
    this.dialog
      .open<PmDayOccurrencesDialog, PmDayOccurrencesDialogData, AppPmOccurrence>(
        PmDayOccurrencesDialog,
        { data: { day: cell.label, occurrences: cell.occurrences } },
      )
      .afterClosed()
      .subscribe((occurrence) => {
        if (occurrence !== undefined) {
          this.openDetails(occurrence, trigger);
        }
      });
  }
}
