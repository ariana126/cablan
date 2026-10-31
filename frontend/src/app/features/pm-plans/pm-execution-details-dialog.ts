import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogContent } from '@angular/material/dialog';

import { formatJalaliCalendarDate } from '../../core/date/calendar-date';
import { formatJalaliDateTime } from '../../core/date/jalali-datetime';
import { AppMaintenanceExecution } from '../../core/maintenance/equipment-gateway';
import { DialogHead } from '../../ui/dialog-head/dialog-head';
import { PmStatusBadge } from '../../ui/pm-status-badge/pm-status-badge';

export interface PmExecutionDetailsDialogData {
  readonly equipmentName: string;
  readonly execution: AppMaintenanceExecution;
}

/** What a fact shows for a value that is not there, as the report pages do. */
const NONE = '—';

/** In the viewer's own time zone, like every other instant the app shows. */
function jalaliInstant(iso: string): string {
  const instant = new Date(iso);
  return Number.isNaN(instant.getTime()) ? NONE : formatJalaliDateTime(instant);
}

/**
 * One «سابقه تعمیرات» row in full, read straight off the row (no request): the five facts the
 * table shows, plus the notes it no longer has room for — written by whoever recorded it, so kept
 * with their line breaks. Read-only; the head's close button and Escape dismiss it.
 */
@Component({
  selector: 'app-pm-execution-details-dialog',
  imports: [DialogHead, MatDialogContent, PmStatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-head heading="جزئیات انجام PM" [subtitle]="data.equipmentName" />

    <mat-dialog-content>
      <dl class="detail-fields">
        <div class="detail-fields__tile detail-fields__tile--wide stack stack--hair">
          <dt>فعالیت</dt>
          <dd class="detail-fields__value">{{ data.execution.activityName }}</dd>
        </div>

        <div class="detail-fields__tile stack stack--hair">
          <dt>موعد</dt>
          <dd class="detail-fields__value">{{ dueDate }}</dd>
        </div>

        <div class="detail-fields__tile stack stack--hair">
          <dt>انجام دهنده</dt>
          <dd class="detail-fields__value">{{ data.execution.performedBy }}</dd>
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
          <dd><app-pm-status-badge [status]="data.execution.status" /></dd>
        </div>

        <div class="detail-fields__tile detail-fields__tile--wide stack stack--hair">
          <dt>توضیحات</dt>
          <dd
            class="detail-fields__value detail-fields__value--note"
            [class.detail-fields__value--none]="!data.execution.notes"
          >
            {{ data.execution.notes || none }}
          </dd>
        </div>
      </dl>
    </mat-dialog-content>
  `,
  styleUrl: './pm-execution-details-dialog.scss',
})
export class PmExecutionDetailsDialog {
  protected readonly data = inject<PmExecutionDetailsDialogData>(MAT_DIALOG_DATA);
  protected readonly none = NONE;

  protected readonly dueDate = formatJalaliCalendarDate(this.data.execution.dueDate);

  protected readonly performedAt = jalaliInstant(this.data.execution.performedAt);
}
