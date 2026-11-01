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
import { mapDeactivatePlanItemError } from './server-errors';
import { Icon } from '../../ui/icon/icon';

export interface ConfirmDeactivatePmPlanItemDialogData {
  readonly equipment: { readonly id: string; readonly name: string };
  readonly item: AppPmPlanItem;
}

/**
 * Deactivates an activity in a plan (issue #91): it leaves the active plan and stops coming due, for
 * good — there is no reactivating it — and its schedule and what was done stay, listed under
 * «فعالیت‌های غیرفعال». Nothing is ever deleted from a plan. A blocking decision, confirmed like a
 * delete (as retiring equipment is).
 */
@Component({
  selector: 'app-confirm-deactivate-pm-plan-item-dialog',
  imports: [ConfirmHead, ErrorBanner, Icon, MatButton, MatDialogActions, MatDialogContent, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-confirm-head heading="غیرفعال‌سازی فعالیت در برنامه">
      فعالیت «{{ data.item.activityName }}» در برنامهٔ تجهیز «{{ data.equipment.name }}» غیرفعال
      می‌شود. برنامه و سوابق انجام آن حفظ می‌شود و دیگر نمی‌توان آن را دوباره فعال کرد.
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
        [disabled]="deactivating()"
        (click)="onConfirm()"
      >
        <mat-icon appIcon="block" />
        غیرفعال‌سازی
      </button>
    </mat-dialog-actions>
  `,
  styleUrl: './confirm-deactivate-pm-plan-item-dialog.scss',
})
export class ConfirmDeactivatePmPlanItemDialog {
  private readonly dialogRef = inject(MatDialogRef<ConfirmDeactivatePmPlanItemDialog, boolean>);
  protected readonly data = inject<ConfirmDeactivatePmPlanItemDialogData>(MAT_DIALOG_DATA);
  private readonly gateway = inject(PmPlansGateway);

  protected readonly deactivating = signal(false);
  protected readonly error = signal('');

  protected async onConfirm(): Promise<void> {
    this.deactivating.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.gateway.deactivateItem(this.data.equipment.id, this.data.item.id));
      this.dialogRef.close(true);
    } catch (deactivateError) {
      this.error.set(mapDeactivatePlanItemError(deactivateError));
    } finally {
      this.deactivating.set(false);
    }
  }

  protected onCancel(): void {
    this.dialogRef.close(false);
  }
}
