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
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';

import { BomsGateway } from '../../core/boms/boms-gateway';
import { DialogHead } from '../../ui/dialog-head/dialog-head';

export interface DailyBomDescriptionDialogData {
  readonly bomId: string;
  readonly description: string;
}

interface DescriptionModel {
  description: string;
}

/** Why the description was not saved, in words the visitor can act on. */
function saveFailure(error: unknown): string {
  return error instanceof HttpErrorResponse && error.status === 403
    ? 'شما اجازهٔ ویرایش آنالیز روزانه را ندارید.'
    : 'توضیحات ذخیره نشد.';
}

/**
 * «ویرایش توضیحات» — edits one daily BOM's description from the dashboard. It sends only the
 * description (`PATCH /boms/:id` leaves every field it is not given alone), and an emptied field is
 * sent as `''`, which clears it. It closes with `true` once saved, so the card can ask for the list
 * to be re-read; a refused or failed save says why in a snackbar and leaves the dialog open with the
 * visitor's text intact.
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
    MatFormField,
    MatInput,
    MatLabel,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-head heading="ویرایش توضیحات" />

    <form novalidate (submit)="onSubmit(); $event.preventDefault()">
      <mat-dialog-content>
        <mat-form-field appearance="outline">
          <mat-label>توضیحات</mat-label>
          <textarea matInput rows="4" [formField]="descriptionForm.description"></textarea>
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

  private readonly model = signal<DescriptionModel>({ description: this.data.description });
  protected readonly descriptionForm = form(this.model);

  protected onSubmit(): Promise<boolean> {
    return submit(this.descriptionForm, async () => {
      try {
        await firstValueFrom(
          this.gateway.update(this.data.bomId, { description: this.model().description }),
          { defaultValue: undefined },
        );
      } catch (error) {
        this.snackBar.open(saveFailure(error), 'باشه', { duration: 5000 });
        return undefined;
      }
      this.dialogRef.close(true);
      return undefined;
    });
  }
}
