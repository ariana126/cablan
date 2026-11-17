import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';

import { AppQcExecution } from '../../core/qc/qc-executions-gateway';
import { formatQcInterval } from '../../core/qc/qc-interval';
import { DialogHead } from '../../ui/dialog-head/dialog-head';
import { Icon } from '../../ui/icon/icon';
import { ConfirmDeleteQcExecutionDialog } from './confirm-delete-qc-execution-dialog';
import { NO_TIME, qcTime } from '../../core/qc/qc-time';

export interface QcExecutionDetailsDialogData {
  readonly execution: AppQcExecution;
  /** The System Admin deletes records (issue #119); nobody else is offered it. */
  readonly canDelete: boolean;
}

/** What closing says: `'deleted'` once the record was deleted from here. */
export type QcExecutionDetailsOutcome = 'deleted' | undefined;

/**
 * One QC record in full, read straight off its row (no request): the row's facts — equipment,
 * activity, who recorded it, when, the interval since the previous record — plus what a row has no
 * room for: when that previous record was, the tracking number and the notes (kept with their line
 * breaks). The head's close button and Escape dismiss it.
 *
 * For the System Admin a footer offers «حذف سابقه», confirmed in a dialog stacked over this one; a
 * deletion closes this one with `'deleted'`, so the list behind re-reads.
 */
@Component({
  selector: 'app-qc-execution-details-dialog',
  imports: [DialogHead, Icon, MatButton, MatDialogActions, MatDialogContent, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-head heading="جزئیات سابقه QC" [subtitle]="execution.equipmentName" />

    <!-- Focusable: eight facts can make it scroll, and nothing else in it takes focus. -->
    <mat-dialog-content tabindex="0">
      <dl class="detail-fields">
        <div class="detail-fields__tile stack stack--hair">
          <dt>تجهیز</dt>
          <dd class="detail-fields__value">{{ execution.equipmentName }}</dd>
        </div>
        <div class="detail-fields__tile stack stack--hair">
          <dt>فعالیت</dt>
          <dd class="detail-fields__value">{{ execution.activityName }}</dd>
        </div>
        <div class="detail-fields__tile stack stack--hair">
          <dt>ثبت کننده</dt>
          <dd class="detail-fields__value">{{ execution.performedByName }}</dd>
        </div>
        <div class="detail-fields__tile stack stack--hair">
          <dt>زمان انجام</dt>
          <dd class="detail-fields__value">{{ performedAt }}</dd>
        </div>
        <div class="detail-fields__tile stack stack--hair">
          <dt>فاصله از انجام قبلی</dt>
          <dd
            class="detail-fields__value"
            [class.detail-fields__value--none]="execution.intervalMinutes === null"
          >
            {{ interval }}
          </dd>
        </div>
        <div class="detail-fields__tile stack stack--hair">
          <dt>انجام قبلی</dt>
          <dd
            class="detail-fields__value"
            [class.detail-fields__value--none]="previousPerformedAt === none"
          >
            {{ previousPerformedAt }}
          </dd>
        </div>
        <div class="detail-fields__tile detail-fields__tile--wide stack stack--hair">
          <dt>شماره ردیابی</dt>
          <dd class="detail-fields__value cell-id">{{ execution.trackingNumber }}</dd>
        </div>
        <div class="detail-fields__tile detail-fields__tile--wide stack stack--hair">
          <dt>توضیحات</dt>
          <dd
            class="detail-fields__value detail-fields__value--note"
            [class.detail-fields__value--none]="!execution.notes"
          >
            {{ execution.notes || none }}
          </dd>
        </div>
      </dl>
    </mat-dialog-content>

    @if (data.canDelete) {
      <mat-dialog-actions class="dialog-footer">
        <button matButton class="button--danger" type="button" (click)="onDelete($event)">
          <mat-icon appIcon="delete" />
          حذف سابقه
        </button>
      </mat-dialog-actions>
    }
  `,
  styleUrl: './qc-execution-details-dialog.scss',
})
export class QcExecutionDetailsDialog {
  private readonly dialogRef = inject(
    MatDialogRef<QcExecutionDetailsDialog, QcExecutionDetailsOutcome>,
  );
  protected readonly data = inject<QcExecutionDetailsDialogData>(MAT_DIALOG_DATA);
  private readonly dialog = inject(MatDialog);

  protected readonly execution = this.data.execution;
  protected readonly none = NO_TIME;
  protected readonly performedAt = qcTime(this.execution.performedAt);
  protected readonly previousPerformedAt = qcTime(this.execution.previousPerformedAt);
  protected readonly interval = formatQcInterval(this.execution.intervalMinutes);

  protected onDelete(event: Event): void {
    this.dialog
      .open(ConfirmDeleteQcExecutionDialog, {
        data: { execution: this.execution },
        restoreFocus: event.currentTarget as HTMLElement,
      })
      .afterClosed()
      .subscribe((deleted) => {
        if (deleted === true) {
          this.dialogRef.close('deleted');
        }
      });
  }
}
