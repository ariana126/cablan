import { HttpErrorResponse } from '@angular/common/http';
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

import { PROBLEM, toProblemDetails } from '../../core/http/problem-details';
import { AppQcExecution, QcExecutionsGateway } from '../../core/qc/qc-executions-gateway';
import { ConfirmHead } from '../../ui/confirm-head/confirm-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { Icon } from '../../ui/icon/icon';
import { qcTime } from '../../core/qc/qc-time';

export interface ConfirmDeleteQcExecutionDialogData {
  readonly execution: AppQcExecution;
}

/** The dialog's alert for a refusal. Branches on `type`, never `detail`. */
function deleteErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 403) {
    return 'شما اجازهٔ انجام این عملیات را ندارید.';
  }
  switch (toProblemDetails(error)?.type) {
    case undefined:
      return 'خطایی در برقراری ارتباط با سرور رخ داد. دوباره تلاش کنید.';
    case PROBLEM.qcExecutionNotFound:
      return 'این سابقه دیگر وجود ندارد.';
    default:
      return 'خطایی غیرمنتظره رخ داد. دوباره تلاش کنید.';
  }
}

/**
 * The System Admin's deletion of one QC record (issue #119). It names the record; afterwards the
 * intervals, counts and last executions follow the records that remain — the API computes them.
 */
@Component({
  selector: 'app-confirm-delete-qc-execution-dialog',
  imports: [ConfirmHead, ErrorBanner, Icon, MatButton, MatDialogActions, MatDialogContent, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-confirm-head heading="حذف سابقه QC">
      سابقه انجام «{{ data.execution.activityName }}» روی «{{ data.execution.equipmentName }}» در
      {{ performedAt }} حذف می‌شود. این کار قابل بازگشت نیست.
    </app-confirm-head>

    @if (error()) {
      <mat-dialog-content>
        <app-error-banner [message]="error()" />
      </mat-dialog-content>
    }

    <mat-dialog-actions class="dialog-footer">
      <button matButton type="button" cdkFocusInitial (click)="dialogRef.close(false)">
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
  styleUrl: './confirm-delete-qc-execution-dialog.scss',
})
export class ConfirmDeleteQcExecutionDialog {
  protected readonly dialogRef = inject(MatDialogRef<ConfirmDeleteQcExecutionDialog, boolean>);
  protected readonly data = inject<ConfirmDeleteQcExecutionDialogData>(MAT_DIALOG_DATA);
  private readonly gateway = inject(QcExecutionsGateway);

  protected readonly performedAt = qcTime(this.data.execution.performedAt);
  protected readonly deleting = signal(false);
  protected readonly error = signal('');

  protected async onConfirm(): Promise<void> {
    this.deleting.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.gateway.delete(this.data.execution.id), {
        defaultValue: undefined,
      });
      this.dialogRef.close(true);
    } catch (deleteError) {
      this.error.set(deleteErrorMessage(deleteError));
    } finally {
      this.deleting.set(false);
    }
  }
}
