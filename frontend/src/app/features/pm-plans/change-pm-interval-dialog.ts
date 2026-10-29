import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { form, FormField, submit } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { firstValueFrom } from 'rxjs';

import { AppPmPlanItem } from '../../core/maintenance/equipment-gateway';
import { PmPlansGateway } from '../../core/maintenance/pm-plans-gateway';
import { DialogHead } from '../../ui/dialog-head/dialog-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { mapPlanItemFormError, wholeDays } from './server-errors';

export interface ChangePmIntervalDialogData {
  readonly equipmentId: string;
  readonly item: AppPmPlanItem;
}

/**
 * Changes how often a plan item comes due. The new interval runs from the item's current
 * occurrence on; past occurrences and their statuses stay as they were (the API's rule).
 */
@Component({
  selector: 'app-change-pm-interval-dialog',
  imports: [
    DialogHead,
    ErrorBanner,
    FormField,
    MatButton,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatError,
    MatFormField,
    MatHint,
    MatInput,
    MatLabel,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-head heading="تغییر دوره" [subtitle]="data.item.activityName" />

    <form novalidate (submit)="onSubmit(); $event.preventDefault()">
      <mat-dialog-content class="stack">
        @if (intervalForm().errors().length) {
          <app-error-banner [message]="intervalForm().errors()[0].message ?? ''" />
        }

        <mat-form-field appearance="outline">
          <mat-label>دوره (روز)</mat-label>
          <input matInput type="number" step="1" [formField]="intervalForm.intervalDays" />
          <mat-hint>دورهٔ تازه از موعد جاری به بعد اعمال می‌شود.</mat-hint>
          @if (
            intervalForm.intervalDays().touched() && intervalForm.intervalDays().errors().length
          ) {
            <mat-error>{{ intervalForm.intervalDays().errors()[0].message }}</mat-error>
          }
        </mat-form-field>
      </mat-dialog-content>

      <mat-dialog-actions class="dialog-footer">
        <button matButton type="button" mat-dialog-close>انصراف</button>
        <button matButton="filled" type="submit" [disabled]="intervalForm().submitting()">
          ثبت
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styleUrl: './pm-plan-dialog.scss',
})
export class ChangePmIntervalDialog {
  private readonly dialogRef = inject(MatDialogRef<ChangePmIntervalDialog, boolean>);
  protected readonly data = inject<ChangePmIntervalDialogData>(MAT_DIALOG_DATA);
  private readonly gateway = inject(PmPlansGateway);

  private readonly model = signal({ intervalDays: this.data.item.intervalDays });

  protected readonly intervalForm = form(this.model, (path) => {
    wholeDays(path.intervalDays);
  });

  protected onSubmit(): Promise<boolean> {
    return submit(this.intervalForm, async () => {
      try {
        await firstValueFrom(
          this.gateway.changeInterval(
            this.data.equipmentId,
            this.data.item.id,
            this.model().intervalDays,
          ),
        );
        this.dialogRef.close(true);
        return undefined;
      } catch (error) {
        return mapPlanItemFormError(error, { intervalDays: this.intervalForm.intervalDays });
      }
    });
  }
}
