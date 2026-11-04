import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';

import { formatJalaliCalendarDate } from '../../core/date/calendar-date';
import { AppMaintenanceExecution } from '../../core/maintenance/equipment-gateway';
import { PmPlansGateway } from '../../core/maintenance/pm-plans-gateway';
import { ConfirmHead } from '../../ui/confirm-head/confirm-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { Icon } from '../../ui/icon/icon';
import { mapPmDeletionError } from './server-errors';

export interface ConfirmDeletePmExecutionDialogData {
  readonly equipmentId: string;
  readonly execution: AppMaintenanceExecution;
}

/**
 * The System Admin's deletion of one recorded execution (issue #110), from a «سابقه PM» row. Named
 * by its activity, due date and performer. Nothing else changes: the occurrence simply has no
 * execution again — overdue (and recordable) until the next due date, missed after it.
 */
@Component({
  selector: 'app-confirm-delete-pm-execution-dialog',
  imports: [ConfirmHead, ErrorBanner, Icon, MatButton, MatDialogActions, MatDialogContent, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-confirm-head heading="حذف سابقه انجام">
      سابقهٔ انجام «{{ data.execution.activityName }}» با موعد {{ dueDate }} که
      {{ data.execution.performedBy }} ثبت کرده است حذف می‌شود و آن موعد دوباره بدون انجام می‌ماند.
      این کار قابل بازگشت نیست.
    </app-confirm-head>

    @if (error()) {
      <mat-dialog-content>
        <app-error-banner [message]="error()" />
      </mat-dialog-content>
    }

    <mat-dialog-actions class="dialog-footer">
      <button matButton type="button" cdkFocusInitial (click)="onCancel()">
        <mat-icon appIcon="cancel" />انصراف
      </button>
      <button
        matButton="filled"
        class="danger"
        type="button"
        [disabled]="deleting()"
        (click)="onConfirm()"
      >
        <mat-icon appIcon="delete" />
        حذف سابقه
      </button>
    </mat-dialog-actions>
  `,
  styleUrl: './confirm-delete-pm-dialog.scss',
})
export class ConfirmDeletePmExecutionDialog {
  private readonly dialogRef = inject(MatDialogRef<ConfirmDeletePmExecutionDialog, boolean>);
  protected readonly data = inject<ConfirmDeletePmExecutionDialogData>(MAT_DIALOG_DATA);
  private readonly gateway = inject(PmPlansGateway);

  protected readonly dueDate = formatJalaliCalendarDate(this.data.execution.dueDate);
  protected readonly deleting = signal(false);
  protected readonly error = signal('');

  protected async onConfirm(): Promise<void> {
    const { equipmentId, execution } = this.data;
    this.deleting.set(true);
    this.error.set('');
    try {
      await firstValueFrom(
        this.gateway.deleteExecution(equipmentId, execution.planItemId, execution.id),
      );
      this.dialogRef.close(true);
    } catch (deleteError) {
      this.error.set(mapPmDeletionError(deleteError, 'حذف سابقه'));
    } finally {
      this.deleting.set(false);
    }
  }

  protected onCancel(): void {
    this.dialogRef.close(false);
  }
}
