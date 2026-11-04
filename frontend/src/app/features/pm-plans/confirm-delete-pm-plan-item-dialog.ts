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

import { formatPersianNumber } from '../../core/i18n/persian-numerals';
import { PmPlansGateway } from '../../core/maintenance/pm-plans-gateway';
import { ConfirmHead } from '../../ui/confirm-head/confirm-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { Icon } from '../../ui/icon/icon';
import { PmPlanRow } from './confirm-delete-pm-executions-dialog';
import { mapPmDeletionError } from './server-errors';

export interface ConfirmDeletePmPlanItemDialogData {
  readonly equipmentId: string;
  readonly item: PmPlanRow;
}

/**
 * The System Admin's deletion of a deactivated plan row (issue #110), from «فعالیت‌های غیرفعال»: the
 * row and every execution recorded against it go. Other rows — of the same activity too — and the
 * activity itself stay. An active row is refused (409 `pm-plan-item-active`), said in the dialog.
 */
@Component({
  selector: 'app-confirm-delete-pm-plan-item-dialog',
  imports: [ConfirmHead, ErrorBanner, Icon, MatButton, MatDialogActions, MatDialogContent, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-confirm-head heading="حذف ردیف غیرفعال برنامه">
      ردیف «{{ data.item.activityName }}» (هر {{ interval }} روز) و همهٔ سوابق انجام آن برای همیشه
      حذف می‌شود. این کار قابل بازگشت نیست.
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
        حذف ردیف
      </button>
    </mat-dialog-actions>
  `,
  styleUrl: './confirm-delete-pm-dialog.scss',
})
export class ConfirmDeletePmPlanItemDialog {
  private readonly dialogRef = inject(MatDialogRef<ConfirmDeletePmPlanItemDialog, boolean>);
  protected readonly data = inject<ConfirmDeletePmPlanItemDialogData>(MAT_DIALOG_DATA);
  private readonly gateway = inject(PmPlansGateway);

  protected readonly interval = formatPersianNumber(this.data.item.intervalDays);
  protected readonly deleting = signal(false);
  protected readonly error = signal('');

  protected async onConfirm(): Promise<void> {
    this.deleting.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.gateway.deleteItem(this.data.equipmentId, this.data.item.id));
      this.dialogRef.close(true);
    } catch (deleteError) {
      this.error.set(mapPmDeletionError(deleteError, 'حذف ردیف'));
    } finally {
      this.deleting.set(false);
    }
  }

  protected onCancel(): void {
    this.dialogRef.close(false);
  }
}
