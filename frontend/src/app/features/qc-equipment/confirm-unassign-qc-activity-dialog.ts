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

import { AppQcActivityStatus, QcEquipmentGateway } from '../../core/qc/qc-equipment-gateway';
import { ConfirmHead } from '../../ui/confirm-head/confirm-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { Icon } from '../../ui/icon/icon';
import { qcFolderErrorMessage } from './server-errors';

export interface ConfirmUnassignQcActivityDialogData {
  readonly equipment: { readonly id: string; readonly name: string };
  readonly activity: AppQcActivityStatus;
}

/**
 * «حذف تخصیص» of one QC activity from one equipment (issue #119): nothing more is recorded for it
 * there, and every record already made stays — which is what the dialog says, so removing an
 * assignment is not read as losing history. Reassigning later re-enables recording.
 */
@Component({
  selector: 'app-confirm-unassign-qc-activity-dialog',
  imports: [ConfirmHead, ErrorBanner, Icon, MatButton, MatDialogActions, MatDialogContent, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-confirm-head heading="حذف تخصیص فعالیت QC">
      تخصیص «{{ data.activity.activityName }}» از «{{ data.equipment.name }}» برداشته می‌شود و دیگر
      برای آن ثبت نمی‌شود؛ سوابق انجام قبلی باقی می‌مانند.
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
        [disabled]="removing()"
        (click)="onConfirm()"
      >
        <mat-icon appIcon="delete" />
        حذف تخصیص
      </button>
    </mat-dialog-actions>
  `,
  styleUrl: './confirm-unassign-qc-activity-dialog.scss',
})
export class ConfirmUnassignQcActivityDialog {
  protected readonly dialogRef = inject(MatDialogRef<ConfirmUnassignQcActivityDialog, boolean>);
  protected readonly data = inject<ConfirmUnassignQcActivityDialogData>(MAT_DIALOG_DATA);
  private readonly gateway = inject(QcEquipmentGateway);

  protected readonly removing = signal(false);
  protected readonly error = signal('');

  protected async onConfirm(): Promise<void> {
    this.removing.set(true);
    this.error.set('');
    try {
      await firstValueFrom(
        this.gateway.unassign(this.data.equipment.id, this.data.activity.activityId),
        { defaultValue: undefined },
      );
      this.dialogRef.close(true);
    } catch (unassignError) {
      this.error.set(qcFolderErrorMessage(unassignError));
    } finally {
      this.removing.set(false);
    }
  }
}
