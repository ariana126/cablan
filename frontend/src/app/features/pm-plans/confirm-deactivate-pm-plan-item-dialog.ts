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

import { AppPmPlanItem } from '../../core/maintenance/equipment-gateway';
import { PmPlansGateway } from '../../core/maintenance/pm-plans-gateway';
import { ConfirmHead } from '../../ui/confirm-head/confirm-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { mapRemovePlanItemError } from './server-errors';
import { Icon } from '../../ui/icon/icon';

export interface ConfirmRemovePmPlanItemDialogData {
  readonly equipment: { readonly id: string; readonly name: string };
  readonly item: AppPmPlanItem;
}

/** Takes an activity out of a plan: it stops coming due, and what was done stays in the history. */
@Component({
  selector: 'app-confirm-remove-pm-plan-item-dialog',
  imports: [ConfirmHead, ErrorBanner, Icon, MatButton, MatDialogActions, MatDialogContent, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-confirm-head heading="حذف فعالیت از برنامه">
      فعالیت «{{ data.item.activityName }}» از برنامهٔ تجهیز «{{ data.equipment.name }}» حذف می‌شود
      و دیگر سررسید نمی‌شود. سابقهٔ انجام آن حفظ می‌شود.
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
        [disabled]="removing()"
        (click)="onConfirm()"
      >
        <mat-icon appIcon="delete" />
        حذف از برنامه
      </button>
    </mat-dialog-actions>
  `,
  styleUrl: './confirm-remove-pm-plan-item-dialog.scss',
})
export class ConfirmRemovePmPlanItemDialog {
  private readonly dialogRef = inject(MatDialogRef<ConfirmRemovePmPlanItemDialog, boolean>);
  protected readonly data = inject<ConfirmRemovePmPlanItemDialogData>(MAT_DIALOG_DATA);
  private readonly gateway = inject(PmPlansGateway);

  protected readonly removing = signal(false);
  protected readonly error = signal('');

  protected async onConfirm(): Promise<void> {
    this.removing.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.gateway.removeItem(this.data.equipment.id, this.data.item.id));
      this.dialogRef.close(true);
    } catch (removeError) {
      this.error.set(mapRemovePlanItemError(removeError));
    } finally {
      this.removing.set(false);
    }
  }

  protected onCancel(): void {
    this.dialogRef.close(false);
  }
}
