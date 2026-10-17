import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
} from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

import { AppUser, UsersGateway } from '../../core/users/users-gateway';
import { mapDeleteError } from './server-errors';
import { ConfirmHead } from '../../ui/confirm-head/confirm-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';

export interface ConfirmDeleteUserDialogData {
  readonly user: AppUser;
}

/**
 * A blocking decision, per the design system's dialog-vs-snackbar guidance: deleting a user is
 * destructive and has to be acknowledged, not merely undoable after the fact.
 */
@Component({
  selector: 'app-confirm-delete-user-dialog',
  imports: [ConfirmHead, ErrorBanner, MatButton, MatDialogActions, MatDialogContent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-confirm-head heading="حذف کاربر">
      کاربر «{{ data.user.name }}» ({{ data.user.username }}) حذف می‌شود. این کار قابل بازگشت نیست.
    </app-confirm-head>

    @if (error()) {
      <mat-dialog-content>
        <app-error-banner [message]="error()" />
      </mat-dialog-content>
    }

    <mat-dialog-actions class="dialog-footer">
      <button matButton type="button" cdkFocusInitial (click)="onCancel()">انصراف</button>
      <button
        matButton="filled"
        class="danger"
        type="button"
        [disabled]="deleting()"
        (click)="onConfirm()"
      >
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
