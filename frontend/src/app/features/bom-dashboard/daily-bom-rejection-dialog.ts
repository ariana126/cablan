import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { form, FormField, required, submit, validate } from '@angular/forms/signals';
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
import { firstValueFrom } from 'rxjs';

import { BomsGateway } from '../../core/boms/boms-gateway';
import { DialogHead } from '../../ui/dialog-head/dialog-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import {
  isAlreadyReviewed,
  mapRejectionError,
  REASON_REQUIRED,
  RejectionFormModel,
} from './server-errors';

/** How the dialog closed, besides a cancel (`undefined`): rejected as asked, or refused because
 * someone else reviewed the daily BOM first — either way the card's view of it is now stale. */
export type DailyBomRejectionOutcome = 'rejected' | 'already-reviewed';

export interface DailyBomRejectionDialogData {
  readonly bomId: string;
  readonly orderNumber: string;
}

/**
 * «عدم تایید» — rejects one pending daily BOM from the dashboard, with the reason the reviewer
 * writes («دلیل عدم تایید»), which becomes its management note. A reason is required in substance:
 * a run of spaces is as blank as an empty box, here as on the API, which answers
 * `rejection-reason-required` for either — shown on the field the same way. It closes with
 * `'rejected'` once rejected, and with `'already-reviewed'` when someone else reviewed the daily BOM
 * first (`bom-already-reviewed`), so the card re-reads either way and says why in the second case.
 * Any other refusal (no permission, a failure) is said at the top of the dialog, the reason kept.
 *
 * The submit button is named exactly «عدم تایید», the card button that opened it: while the dialog
 * is open the page behind it is `aria-hidden`, so the two never compete for that name.
 */
@Component({
  selector: 'app-daily-bom-rejection-dialog',
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
    MatInput,
    MatLabel,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-head
      heading="عدم تایید آنالیز روزانه"
      [subtitle]="'شماره سفارش ' + data.orderNumber"
    />

    <form novalidate (submit)="onSubmit(); $event.preventDefault()">
      <mat-dialog-content class="stack">
        <!-- A failure that belongs to no single field, at the top of the content. -->
        @if (rejectionForm().errors().length) {
          <app-error-banner [message]="rejectionForm().errors()[0].message ?? ''" />
        }

        <mat-form-field appearance="outline">
          <mat-label>دلیل عدم تایید</mat-label>
          <textarea matInput rows="4" [formField]="rejectionForm.reason"></textarea>
          @if (rejectionForm.reason().touched() && rejectionForm.reason().errors().length) {
            <mat-error>{{ rejectionForm.reason().errors()[0].message }}</mat-error>
          }
        </mat-form-field>
      </mat-dialog-content>

      <mat-dialog-actions class="dialog-footer">
        <button matButton type="button" mat-dialog-close>انصراف</button>
        <button matButton="filled" type="submit" [disabled]="rejectionForm().submitting()">
          عدم تایید
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styleUrl: './daily-bom-rejection-dialog.scss',
})
export class DailyBomRejectionDialog {
  private readonly dialogRef = inject(
    MatDialogRef<DailyBomRejectionDialog, DailyBomRejectionOutcome>,
  );
  protected readonly data = inject<DailyBomRejectionDialogData>(MAT_DIALOG_DATA);
  private readonly gateway = inject(BomsGateway);

  private readonly model = signal<RejectionFormModel>({ reason: '' });
  protected readonly rejectionForm = form(this.model, (path) => {
    required(path.reason, { message: REASON_REQUIRED });
    // The API trims the reason before it judges it, so a run of spaces is as blank as nothing.
    validate(path.reason, ({ value }) =>
      value() !== '' && value().trim() === ''
        ? { kind: 'required', message: REASON_REQUIRED }
        : undefined,
    );
  });

  protected onSubmit(): Promise<boolean> {
    return submit(this.rejectionForm, async () => {
      try {
        await firstValueFrom(this.gateway.reject(this.data.bomId, this.model().reason), {
          defaultValue: undefined,
        });
      } catch (error) {
        if (isAlreadyReviewed(error)) {
          // Nothing left to reject here: close, and let the card re-read and say why.
          this.dialogRef.close('already-reviewed');
          return undefined;
        }
        return mapRejectionError(error, this.rejectionForm);
      }
      this.dialogRef.close('rejected');
      return undefined;
    });
  }
}
