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
import { firstValueFrom, map } from 'rxjs';

import { formatPersianNumber } from '../../core/i18n/persian-numerals';
import { AppPmPlanItem, EquipmentGateway } from '../../core/maintenance/equipment-gateway';
import { PmPlansGateway } from '../../core/maintenance/pm-plans-gateway';
import { ConfirmHead } from '../../ui/confirm-head/confirm-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { Icon } from '../../ui/icon/icon';
import { mapPmDeletionError } from './server-errors';

/** What names a plan row — active or deactivated alike. */
export type PmPlanRow = Pick<AppPmPlanItem, 'id' | 'activityName' | 'intervalDays'>;

export interface ConfirmDeletePmExecutionsDialogData {
  readonly equipmentId: string;
  readonly item: PmPlanRow;
}

/**
 * The System Admin's deletion of every execution recorded against one plan row (issue #110) — from
 * an active row's menu or a deactivated row's button. It names the row (activity and interval, since
 * an activity may have had several rows) and counts what goes, read from the equipment's history,
 * before «حذف همه سوابق» can be pressed. The row itself stays.
 */
@Component({
  selector: 'app-confirm-delete-pm-executions-dialog',
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
    <app-confirm-head heading="حذف همه سوابق">
      همهٔ سوابق انجام ردیف «{{ data.item.activityName }}» (هر {{ interval }} روز) حذف می‌شود؛ خود
      ردیف در برنامه می‌ماند. این کار قابل بازگشت نیست.
    </app-confirm-head>

    <mat-dialog-content class="stack stack--tight">
      @if (count.isLoading()) {
        <mat-progress-bar mode="indeterminate" aria-label="در حال شمارش سوابق انجام" />
      } @else if (count.error()) {
        <app-error-banner
          message="سوابق این ردیف شمرده نشد."
          retryLabel="تلاش دوباره"
          (retry)="count.reload()"
        />
      } @else {
        <p class="delete-pm__count">{{ countText() }}</p>
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
        [disabled]="!count.hasValue() || deleting()"
        (click)="onConfirm()"
      >
        <mat-icon appIcon="delete" />
        حذف همه سوابق
      </button>
    </mat-dialog-actions>
  `,
  styleUrl: './confirm-delete-pm-dialog.scss',
})
export class ConfirmDeletePmExecutionsDialog {
  private readonly dialogRef = inject(MatDialogRef<ConfirmDeletePmExecutionsDialog, boolean>);
  protected readonly data = inject<ConfirmDeletePmExecutionsDialogData>(MAT_DIALOG_DATA);
  private readonly equipmentGateway = inject(EquipmentGateway);
  private readonly plansGateway = inject(PmPlansGateway);

  protected readonly interval = formatPersianNumber(this.data.item.intervalDays);
  protected readonly deleting = signal(false);
  protected readonly error = signal('');

  /** How many executions were recorded against this row — not other rows of the same activity. */
  protected readonly count = rxResource({
    stream: () =>
      this.equipmentGateway
        .maintenanceHistory(this.data.equipmentId)
        .pipe(
          map(
            (history) =>
              history.filter(
                (entry) => entry.kind === 'executed' && entry.planItemId === this.data.item.id,
              ).length,
          ),
        ),
  });

  protected readonly countText = computed(() =>
    this.count.hasValue()
      ? `${formatPersianNumber(this.count.value())} سابقهٔ انجام حذف می‌شود.`
      : '',
  );

  protected async onConfirm(): Promise<void> {
    this.deleting.set(true);
    this.error.set('');
    try {
      await firstValueFrom(
        this.plansGateway.deleteExecutions(this.data.equipmentId, this.data.item.id),
      );
      this.dialogRef.close(true);
    } catch (deleteError) {
      this.error.set(mapPmDeletionError(deleteError, 'حذف سوابق'));
    } finally {
      this.deleting.set(false);
    }
  }

  protected onCancel(): void {
    this.dialogRef.close(false);
  }
}
