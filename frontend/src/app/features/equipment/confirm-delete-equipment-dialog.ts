import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import { firstValueFrom, forkJoin } from 'rxjs';

import { formatPersianNumber } from '../../core/i18n/persian-numerals';
import { AppEquipment, EquipmentGateway } from '../../core/maintenance/equipment-gateway';
import { ConfirmHead } from '../../ui/confirm-head/confirm-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { Icon } from '../../ui/icon/icon';
import { mapDeleteEquipmentError } from './server-errors';

export interface ConfirmDeleteEquipmentDialogData {
  readonly equipment: AppEquipment;
}

/**
 * The System Admin's deletion of retired equipment (issue #110) — the one cascade in the product:
 * the equipment, every plan row (active and deactivated) and every execution recorded on it go
 * together, and its name is free again. So the confirmation first reads what goes — the folder and
 * its history — and says it, rows by activity and executions by count, before «حذف تجهیز» can be
 * pressed. A refusal (`equipment-not-retired`, …) is the dialog's alert; it stays open.
 */
@Component({
  selector: 'app-confirm-delete-equipment-dialog',
  imports: [
    ConfirmHead,
    ErrorBanner,
    Icon,
    MatButton,
    MatDialogActions,
    MatDialogContent,
    MatIcon,
    MatProgressBar,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-confirm-head heading="حذف تجهیز">
      تجهیز «{{ data.equipment.name }}» برای همیشه حذف می‌شود و نام آن دوباره آزاد می‌شود. این کار
      قابل بازگشت نیست.
    </app-confirm-head>

    <mat-dialog-content class="stack stack--tight">
      @if (whatGoes.isLoading()) {
        <mat-progress-bar mode="indeterminate" aria-label="در حال بارگذاری آنچه حذف می‌شود" />
      } @else if (whatGoes.error()) {
        <app-error-banner
          message="آنچه با این تجهیز حذف می‌شود بارگذاری نشد."
          retryLabel="تلاش دوباره"
          (retry)="whatGoes.reload()"
        />
      } @else if (summary(); as text) {
        <p class="delete-equipment__summary">{{ text }}</p>
      }

      @if (error()) {
        <app-error-banner [message]="error()" />
      }
    </mat-dialog-content>

    <mat-dialog-actions class="dialog-footer">
      <button matButton type="button" cdkFocusInitial (click)="onCancel()">
        <mat-icon appIcon="cancel" />انصراف
      </button>
      <button
        matButton="filled"
        class="danger"
        type="button"
        [disabled]="!whatGoes.hasValue() || deleting()"
        (click)="onConfirm()"
      >
        <mat-icon appIcon="delete" />
        حذف تجهیز
      </button>
    </mat-dialog-actions>
  `,
  styleUrl: './confirm-delete-equipment-dialog.scss',
})
export class ConfirmDeleteEquipmentDialog {
  private readonly dialogRef = inject(MatDialogRef<ConfirmDeleteEquipmentDialog, boolean>);
  protected readonly data = inject<ConfirmDeleteEquipmentDialogData>(MAT_DIALOG_DATA);
  private readonly gateway = inject(EquipmentGateway);

  protected readonly deleting = signal(false);
  protected readonly error = signal('');

  protected readonly whatGoes = rxResource({
    stream: () =>
      forkJoin({
        detail: this.gateway.get(this.data.equipment.id),
        history: this.gateway.maintenanceHistory(this.data.equipment.id),
      }),
  });

  /** «همراه با آن ۲ ردیف برنامه PM («تعویض روغن»، «بررسی تابلو برق») و ۳ سابقهٔ انجام حذف می‌شود.» */
  protected readonly summary = computed(() => {
    if (!this.whatGoes.hasValue()) {
      return '';
    }
    const { detail, history } = this.whatGoes.value();
    const rows = [...detail.planItems, ...detail.inactivePlanItems];
    // Missed due dates (issue #114) are in the history too, but are no executions to delete.
    const executions = history.filter((entry) => entry.kind === 'executed').length;
    // Every execution belongs to a plan row, so no rows means no history either.
    if (rows.length === 0) {
      return 'این تجهیز ردیف برنامه یا سابقهٔ انجامی ندارد.';
    }
    const names = rows.map((row) => `«${row.activityName}»`).join('، ');
    return (
      `همراه با آن ${formatPersianNumber(rows.length)} ردیف برنامه PM (${names}) و ` +
      `${formatPersianNumber(executions)} سابقهٔ انجام حذف می‌شود.`
    );
  });

  protected async onConfirm(): Promise<void> {
    this.deleting.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.gateway.delete(this.data.equipment.id));
      this.dialogRef.close(true);
    } catch (deleteError) {
      this.error.set(mapDeleteEquipmentError(deleteError));
    } finally {
      this.deleting.set(false);
    }
  }

  protected onCancel(): void {
    this.dialogRef.close(false);
  }
}
