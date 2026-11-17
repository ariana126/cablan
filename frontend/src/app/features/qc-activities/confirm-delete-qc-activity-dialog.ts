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

import { AppQcActivity, QcActivitiesGateway } from '../../core/qc/qc-activities-gateway';
import { ConfirmHead } from '../../ui/confirm-head/confirm-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { Icon } from '../../ui/icon/icon';
import { mapQcActivityDeleteError } from './server-errors';

export interface ConfirmDeleteQcActivityDialogData {
  readonly activity: AppQcActivity;
}

/**
 * Deletes a QC activity nothing uses. One assigned to an equipment, or ever recorded (even after its
 * assignment was removed), is refused (issue #94) — the sentence saying where is the dialog's alert,
 * and the dialog stays open. Nobody, the System Admin included, deletes one in use.
 */
@Component({
  selector: 'app-confirm-delete-qc-activity-dialog',
  imports: [ConfirmHead, ErrorBanner, Icon, MatButton, MatDialogActions, MatDialogContent, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-confirm-head heading="حذف فعالیت QC">
      فعالیت QC «{{ data.activity.name }}» حذف می‌شود. این کار قابل بازگشت نیست.
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
        حذف فعالیت QC
      </button>
    </mat-dialog-actions>
  `,
  styleUrl: './confirm-delete-qc-activity-dialog.scss',
})
export class ConfirmDeleteQcActivityDialog {
  protected readonly dialogRef = inject(MatDialogRef<ConfirmDeleteQcActivityDialog, boolean>);
  protected readonly data = inject<ConfirmDeleteQcActivityDialogData>(MAT_DIALOG_DATA);
  private readonly gateway = inject(QcActivitiesGateway);

  protected readonly deleting = signal(false);
  protected readonly error = signal('');

  protected async onConfirm(): Promise<void> {
    this.deleting.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.gateway.delete(this.data.activity.id), { defaultValue: undefined });
      this.dialogRef.close(true);
    } catch (deleteError) {
      this.error.set(mapQcActivityDeleteError(deleteError));
    } finally {
      this.deleting.set(false);
    }
  }
}
