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

import { AppUser, UsersGateway } from '../../core/users/users-gateway';
import { mapDeleteError } from './server-errors';

export interface ConfirmDeleteUserDialogData {
  readonly user: AppUser;
}

/**
 * A blocking decision, per the design system's dialog-vs-snackbar guidance: deleting a user is
 * destructive and has to be acknowledged, not merely undoable after the fact.
 */
@Component({
  selector: 'app-confirm-delete-user-dialog',
  imports: [MatButton, MatDialogActions, MatDialogContent, MatDialogTitle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>حذف کاربر</h2>

    <mat-dialog-content class="stack">
      <p>
        کاربر «{{ data.user.name }}» ({{ data.user.username }}) حذف می‌شود. این کار قابل بازگشت
        نیست.
      </p>
      @if (error()) {
        <p class="form-error" role="alert">{{ error() }}</p>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton type="button" (click)="onCancel()">انصراف</button>
      <button matButton="filled" type="button" [disabled]="deleting()" (click)="onConfirm()">
        حذف کاربر
      </button>
    </mat-dialog-actions>
  `,
  styleUrl: './confirm-delete-user-dialog.scss',
})
export class ConfirmDeleteUserDialog {
  private readonly dialogRef = inject(MatDialogRef<ConfirmDeleteUserDialog, boolean>);
  protected readonly data = inject<ConfirmDeleteUserDialogData>(MAT_DIALOG_DATA);
  private readonly usersGateway = inject(UsersGateway);

  protected readonly deleting = signal(false);
  protected readonly error = signal('');

  protected async onConfirm(): Promise<void> {
    this.deleting.set(true);
    this.error.set('');

    try {
      await firstValueFrom(this.usersGateway.delete(this.data.user.id));
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
