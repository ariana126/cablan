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
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatIcon } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';

import { BomEditSource, UpdateBomDto } from '../../api/model';
import { BomsGateway } from '../../core/boms/boms-gateway';
import { DialogHead } from '../../ui/dialog-head/dialog-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { EditReasonFormModel, mapDashboardEditError } from './server-errors';
import { Icon } from '../../ui/icon/icon';

export interface DailyBomEditReasonDialogData {
  readonly bomId: string;
  readonly orderNumber: string;
  /** The edit as the card built it (`materialWeightEdit`), without its reason. */
  readonly changes: UpdateBomDto;
}

/**
 * Asks why before a card's inline weight correction is saved (issue #73): «ذخیره» on the card opens
 * this, and «ثبت» here sends the edit with the reason as `editReason` and `editSource: 'dashboard'`.
 * It closes with `true` once saved, so the card closes its input and asks for the re-read; «انصراف»
 * leaves the card's input open as it was.
 *
 * The reason is not required client-side — a save that changes nothing goes through without one —
 * so the API's `edit-reason-required` is what shows «نوشتن دلیل ویرایش لازم است» on the field. Any
 * other refusal is said at the top of the dialog, the reason kept.
 */
@Component({
  selector: 'app-daily-bom-edit-reason-dialog',
  imports: [
    DialogHead,
    ErrorBanner,
    FormField,
    Icon,
    MatButton,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatError,
    MatFormField,
    MatIcon,
    MatInput,
    MatLabel,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-head
      heading="ویرایش وزن مواد اولیه"
      [subtitle]="'شماره سفارش ' + data.orderNumber"
    />

    <form novalidate (submit)="onSubmit(); $event.preventDefault()">
      <mat-dialog-content class="stack">
        <!-- A failure that belongs to no single field, at the top of the content. -->
        @if (reasonForm().errors().length) {
          <app-error-banner [message]="reasonForm().errors()[0].message ?? ''" />
        }

        <mat-form-field appearance="outline">
          <mat-label>دلیل ویرایش</mat-label>
          <textarea matInput rows="3" [formField]="reasonForm.editReason"></textarea>
          @if (reasonForm.editReason().touched() && reasonForm.editReason().errors().length) {
            <mat-error>{{ reasonForm.editReason().errors()[0].message }}</mat-error>
          }
        </mat-form-field>
      </mat-dialog-content>

      <mat-dialog-actions class="dialog-footer">
        <button matButton type="button" mat-dialog-close>
          <mat-icon appIcon="cancel" />انصراف
        </button>
        <button matButton="filled" type="submit" [disabled]="reasonForm().submitting()">
          <mat-icon appIcon="check" />ثبت
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styleUrl: './daily-bom-edit-reason-dialog.scss',
})
export class DailyBomEditReasonDialog {
  private readonly dialogRef = inject(MatDialogRef<DailyBomEditReasonDialog, boolean>);
  protected readonly data = inject<DailyBomEditReasonDialogData>(MAT_DIALOG_DATA);
  private readonly gateway = inject(BomsGateway);

  private readonly model = signal<EditReasonFormModel>({ editReason: '' });
  protected readonly reasonForm = form(this.model);

  protected onSubmit(): Promise<boolean> {
    return submit(this.reasonForm, async () => {
      try {
        await firstValueFrom(
          this.gateway.update(this.data.bomId, {
            ...this.data.changes,
            editReason: this.model().editReason,
            editSource: BomEditSource.dashboard,
          }),
          { defaultValue: undefined },
        );
      } catch (error) {
        return mapDashboardEditError(error, this.reasonForm);
      }
      this.dialogRef.close(true);
      return undefined;
    });
  }
}
