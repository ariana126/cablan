import { HttpErrorResponse } from '@angular/common/http';
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
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';

import { BomEditSource } from '../../api/model';
import { EDIT_REASON_REQUIRED } from '../../core/boms/bom-edit-history';
import { BomsGateway } from '../../core/boms/boms-gateway';
import { PROBLEM, toProblemDetails } from '../../core/http/problem-details';
import { DialogHead } from '../../ui/dialog-head/dialog-head';

export interface DailyBomDescriptionDialogData {
  readonly bomId: string;
  readonly description: string;
}

interface DescriptionModel {
  description: string;
  editReason: string;
}

/** Why the description was not saved, in words the visitor can act on. */
function saveFailure(error: unknown): string {
  return error instanceof HttpErrorResponse && error.status === 403
    ? 'شما اجازهٔ ویرایش آنالیز روزانه را ندارید.'
    : 'توضیحات ذخیره نشد.';
}

/**
 * «ویرایش توضیحات» — edits one daily BOM's description from the dashboard. It sends only the
 * description (`PATCH /boms/:id` leaves every field it is not given alone) and why («دلیل ویرایش»,
 * `editSource: 'dashboard'`, issue #73); an emptied description is sent as `''`, which clears it. It
 * closes with `true` once saved, so the card can ask for the list to be re-read. The reason is not
 * required client-side (an unchanged description needs none); the API's `edit-reason-required`
 * shows on the reason field. Any other refusal says why in a snackbar and leaves the dialog open
 * with the visitor's text intact.
 */
@Component({
  selector: 'app-daily-bom-description-dialog',
  imports: [
    DialogHead,
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
    <app-dialog-head heading="ویرایش توضیحات" />

    <form novalidate (submit)="onSubmit(); $event.preventDefault()">
      <mat-dialog-content class="stack">
        <mat-form-field appearance="outline">
          <mat-label>توضیحات</mat-label>
          <textarea matInput rows="4" [formField]="descriptionForm.description"></textarea>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>دلیل ویرایش</mat-label>
          <textarea matInput rows="2" [formField]="descriptionForm.editReason"></textarea>
          @if (
            descriptionForm.editReason().touched() && descriptionForm.editReason().errors().length
          ) {
            <mat-error>{{ descriptionForm.editReason().errors()[0].message }}</mat-error>
          }
        </mat-form-field>
      </mat-dialog-content>

      <mat-dialog-actions class="dialog-footer">
        <button matButton type="button" mat-dialog-close>انصراف</button>
        <button matButton="filled" type="submit" [disabled]="descriptionForm().submitting()">
          ذخیره
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styleUrl: './daily-bom-description-dialog.scss',
})
export class DailyBomDescriptionDialog {
  private readonly dialogRef = inject(MatDialogRef<DailyBomDescriptionDialog, boolean>);
  private readonly data = inject<DailyBomDescriptionDialogData>(MAT_DIALOG_DATA);
  private readonly gateway = inject(BomsGateway);
  private readonly snackBar = inject(MatSnackBar);

  private readonly model = signal<DescriptionModel>({
    description: this.data.description,
    editReason: '',
  });
  protected readonly descriptionForm = form(this.model);

  protected onSubmit(): Promise<boolean> {
    return submit(this.descriptionForm, async () => {
      try {
        await firstValueFrom(
          this.gateway.update(this.data.bomId, {
            description: this.model().description,
            editReason: this.model().editReason,
            editSource: BomEditSource.dashboard,
          }),
          { defaultValue: undefined },
        );
      } catch (error) {
        if (toProblemDetails(error)?.type === PROBLEM.editReasonRequired) {
          return [
            {
              fieldTree: this.descriptionForm.editReason,
              kind: 'server',
              message: EDIT_REASON_REQUIRED,
            },
          ];
        }
        this.snackBar.open(saveFailure(error), 'باشه', { duration: 5000 });
        return undefined;
      }
      this.dialogRef.close(true);
      return undefined;
    });
  }
}
