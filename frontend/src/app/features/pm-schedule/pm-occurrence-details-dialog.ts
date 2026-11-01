import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogContent } from '@angular/material/dialog';

import { formatJalaliCalendarDate } from '../../core/date/calendar-date';
import { formatJalaliDateTime } from '../../core/date/jalali-datetime';
import { formatPersianNumber } from '../../core/i18n/persian-numerals';
import { AppPmOccurrence } from '../../core/maintenance/pm-schedule-gateway';
import { DialogHead } from '../../ui/dialog-head/dialog-head';
import { PmStatusBadge } from '../../ui/pm-status-badge/pm-status-badge';

export interface PmOccurrenceDetailsDialogData {
  readonly occurrence: AppPmOccurrence;
}

/** What a fact shows for a value the occurrence does not have. */
const NONE = '—';

/** In the viewer's own time zone, like every other instant the app shows. */
function jalaliInstant(iso: string | null): string {
  if (iso === null) {
    return NONE;
  }
  const instant = new Date(iso);
  return Number.isNaN(instant.getTime()) ? NONE : formatJalaliDateTime(instant);
}

/**
 * One PM occurrence in full, opened from its chip on the PM calendar and read straight off it (no
 * request): equipment, activity, the **original** due date (a late one sits on the calendar on the
 * day it was done), when it was done, its status, how many days late, who did it and their notes.
 * Every fact it does not have reads «—» — the delay included, unlike the table's hyphen, since here
 * it stands among other missing facts rather than in a column of quantities.
 *
 * Two facts to a row, the performer and the notes a row each, so all eight fit without scrolling
 * at an ordinary desktop height. The facts are one `<dl>`, a `<dt>` and a `<dd>` each, in that order. Read-only; the head's «بستن»
 * and Escape dismiss it.
 */
@Component({
  selector: 'app-pm-occurrence-details-dialog',
  imports: [DialogHead, MatDialogContent, PmStatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-head heading="جزئیات موعد PM" />

    <!-- Focusable, so a keyboard can scroll the facts on a short screen: the close button sits
         outside the content and arrow keys would not reach it. -->
    <mat-dialog-content tabindex="0">
      <dl class="detail-fields">
        <div class="detail-fields__tile stack stack--hair">
          <dt>تجهیز</dt>
          <dd class="detail-fields__value">{{ occurrence.equipmentName }}</dd>
        </div>

        <div class="detail-fields__tile stack stack--hair">
          <dt>فعالیت</dt>
          <dd class="detail-fields__value">{{ occurrence.activityName }}</dd>
        </div>

        <div class="detail-fields__tile stack stack--hair">
          <dt>موعد</dt>
          <dd class="detail-fields__value">{{ dueDate }}</dd>
        </div>

        <div class="detail-fields__tile stack stack--hair">
          <dt>زمان انجام</dt>
          <dd
            class="detail-fields__value"
            [class.detail-fields__value--none]="performedAt === none"
          >
            {{ performedAt }}
          </dd>
        </div>

        <div class="detail-fields__tile stack stack--hair">
          <dt>وضعیت</dt>
          <dd><app-pm-status-badge [status]="occurrence.status" /></dd>
        </div>

        <div class="detail-fields__tile stack stack--hair">
          <dt>مقدار تاخیر</dt>
          <dd class="detail-fields__value" [class.detail-fields__value--none]="delay === none">
            {{ delay }}
          </dd>
        </div>

        <div class="detail-fields__tile detail-fields__tile--wide stack stack--hair">
          <dt>انجام دهنده</dt>
          <dd
            class="detail-fields__value"
            [class.detail-fields__value--none]="occurrence.performedBy === null"
          >
            {{ occurrence.performedBy ?? none }}
          </dd>
        </div>

        <div class="detail-fields__tile detail-fields__tile--wide stack stack--hair">
          <dt>توضیحات</dt>
          <dd
            class="detail-fields__value detail-fields__value--note"
            [class.detail-fields__value--none]="!occurrence.notes"
          >
            {{ occurrence.notes || none }}
          </dd>
        </div>
      </dl>
    </mat-dialog-content>
  `,
  styleUrl: './pm-occurrence-details-dialog.scss',
})
export class PmOccurrenceDetailsDialog {
  protected readonly occurrence = inject<PmOccurrenceDetailsDialogData>(MAT_DIALOG_DATA).occurrence;
  protected readonly none = NONE;

  protected readonly dueDate = formatJalaliCalendarDate(this.occurrence.dueDate);
  protected readonly performedAt = jalaliInstant(this.occurrence.performedAt);
  protected readonly delay =
    this.occurrence.daysLate === null
      ? NONE
      : `${formatPersianNumber(this.occurrence.daysLate)} روز`;
}
