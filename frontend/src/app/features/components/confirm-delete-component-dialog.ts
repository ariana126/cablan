import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
} from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

import {
  AppComponent as AppComponentRecord,
  ComponentsGateway,
} from '../../core/components/components-gateway';
import { mapDeleteError } from './server-errors';
import { ConfirmHead } from '../../ui/confirm-head/confirm-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';

export interface ConfirmDeleteComponentDialogData {
  readonly component: AppComponentRecord;
}

/**
 * A blocking decision, per the design system's dialog-vs-snackbar guidance: deleting a component
 * is destructive and has to be acknowledged, not merely undoable after the fact.
 */
@Component({
  selector: 'app-confirm-delete-component-dialog',
  imports: [ConfirmHead, ErrorBanner, MatButton, MatDialogActions, MatDialogContent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-confirm-head heading="حذف جز">
      جز «{{ data.component.name }}» حذف می‌شود. این کار قابل بازگشت نیست.
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
        حذف جز
      </button>
    </mat-dialog-actions>
  `,
  styleUrl: './confirm-delete-component-dialog.scss',
})
export class ConfirmDeleteComponentDialog {
  private readonly dialogRef = inject(MatDialogRef<ConfirmDeleteComponentDialog, boolean>);
  protected readonly data = inject<ConfirmDeleteComponentDialogData>(MAT_DIALOG_DATA);
  private readonly componentsGateway = inject(ComponentsGateway);

  protected readonly deleting = signal(false);
  protected readonly error = signal('');

  protected async onConfirm(): Promise<void> {
    this.deleting.set(true);
    this.error.set('');

    try {
      await firstValueFrom(this.componentsGateway.delete(this.data.component.id));
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
