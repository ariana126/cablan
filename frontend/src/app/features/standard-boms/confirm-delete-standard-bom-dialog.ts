import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

import {
  AppStandardBom,
  StandardBomsGateway,
} from '../../core/standard-boms/standard-boms-gateway';
import { mapDeleteError } from './server-errors';

export interface ConfirmDeleteStandardBomDialogData {
  readonly standardBom: AppStandardBom;
}

/**
 * A blocking decision, per the design system's dialog-vs-snackbar guidance: deleting a Standard BOM
 * is destructive and has to be acknowledged, not merely undoable after the fact.
 */
@Component({
  selector: 'app-confirm-delete-standard-bom-dialog',
  imports: [MatButton, MatDialogActions, MatDialogContent, MatDialogTitle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>حذف آنالیز استاندارد</h2>

    <mat-dialog-content class="stack">
      <p>
        آنالیز استاندارد با کد MI «{{ data.standardBom.miCode }}» حذف می‌شود. این کار قابل بازگشت
        نیست.
      </p>
      @if (error()) {
        <p class="form-error" role="alert">{{ error() }}</p>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton type="button" (click)="onCancel()">انصراف</button>
      <button matButton="filled" type="button" [disabled]="deleting()" (click)="onConfirm()">
        حذف
      </button>
    </mat-dialog-actions>
  `,
  styleUrl: './confirm-delete-standard-bom-dialog.scss',
})
export class ConfirmDeleteStandardBomDialog {
  private readonly dialogRef = inject(MatDialogRef<ConfirmDeleteStandardBomDialog, boolean>);
  protected readonly data = inject<ConfirmDeleteStandardBomDialogData>(MAT_DIALOG_DATA);
  private readonly standardBomsGateway = inject(StandardBomsGateway);

  protected readonly deleting = signal(false);
  protected readonly error = signal('');

  protected async onConfirm(): Promise<void> {
    this.deleting.set(true);
    this.error.set('');

    try {
      await firstValueFrom(this.standardBomsGateway.delete(this.data.standardBom.id));
      this.dialogRef.close(true);
    } catch (deleteError) {
      this.error.set(mapDeleteError(deleteError));
    } finally {
      this.deleting.set(false);
    }
  }

  protected onCancel(): void {
    this.dialogRef.close(false);
  }
}
