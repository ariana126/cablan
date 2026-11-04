import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';

import { DialogHead } from '../dialog-head/dialog-head';
import { Icon } from '../icon/icon';

export interface CorrectionConfirmationDialogData {
  /** Where the record is used and that the change goes there too —
   * `correctionConfirmationMessage()`. */
  readonly message: string;
}

/**
 * The System Admin's confirmation of a correction to a record other records use (issue #110),
 * stacked over the edit dialog that was refused. Its title names the dialog. «تایید» closes with
 * `true`; «انصراف», the close button and Escape with something else — and then nothing is sent.
 */
@Component({
  selector: 'app-correction-confirmation-dialog',
  imports: [DialogHead, Icon, MatButton, MatDialogActions, MatDialogContent, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-head heading="اعمال در اطلاعات و سوابق مرتبط" />

    <mat-dialog-content>
      <p class="correction-confirmation__message">{{ data.message }}</p>
    </mat-dialog-content>

    <mat-dialog-actions class="dialog-footer">
      <button matButton type="button" cdkFocusInitial (click)="dialogRef.close(false)">
        <mat-icon appIcon="cancel" />انصراف
      </button>
      <button matButton="filled" type="button" (click)="dialogRef.close(true)">
        <mat-icon appIcon="check" />تایید
      </button>
    </mat-dialog-actions>
  `,
  styleUrl: './correction-confirmation-dialog.scss',
})
export class CorrectionConfirmationDialog {
  protected readonly dialogRef = inject(MatDialogRef<CorrectionConfirmationDialog, boolean>);
  protected readonly data = inject<CorrectionConfirmationDialogData>(MAT_DIALOG_DATA);
}
