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
  AppComponent as AppComponentRecord,
  ComponentsGateway,
} from '../../core/components/components-gateway';
import { mapDeleteError } from './server-errors';

export interface ConfirmDeleteComponentDialogData {
  readonly component: AppComponentRecord;
}

/**
 * A blocking decision, per the design system's dialog-vs-snackbar guidance: deleting a component
 * is destructive and has to be acknowledged, not merely undoable after the fact.
 */
@Component({
  selector: 'app-confirm-delete-component-dialog',
  imports: [MatButton, MatDialogActions, MatDialogContent, MatDialogTitle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>حذف جز</h2>

    <mat-dialog-content class="stack">
      <p>جز «{{ data.component.name }}» حذف می‌شود. این کار قابل بازگشت نیست.</p>
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
