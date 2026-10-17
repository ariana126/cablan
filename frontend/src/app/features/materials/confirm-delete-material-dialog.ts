import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
} from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

import { AppMaterial, MaterialsGateway } from '../../core/materials/materials-gateway';
import { mapDeleteError } from './server-errors';
import { ConfirmHead } from '../../ui/confirm-head/confirm-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';

export interface ConfirmDeleteMaterialDialogData {
  readonly material: AppMaterial;
}

/**
 * A blocking decision, per the design system's dialog-vs-snackbar guidance: deleting a raw
 * material is destructive and has to be acknowledged, not merely undoable after the fact.
 */
@Component({
  selector: 'app-confirm-delete-material-dialog',
  imports: [ConfirmHead, ErrorBanner, MatButton, MatDialogActions, MatDialogContent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-confirm-head heading="حذف مواد اولیه">
      مادهٔ اولیهٔ «{{ data.material.name }}» حذف می‌شود. این کار قابل بازگشت نیست.
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
        حذف مواد اولیه
      </button>
    </mat-dialog-actions>
  `,
  styleUrl: './confirm-delete-material-dialog.scss',
})
export class ConfirmDeleteMaterialDialog {
  private readonly dialogRef = inject(MatDialogRef<ConfirmDeleteMaterialDialog, boolean>);
  protected readonly data = inject<ConfirmDeleteMaterialDialogData>(MAT_DIALOG_DATA);
  private readonly materialsGateway = inject(MaterialsGateway);

  protected readonly deleting = signal(false);
  protected readonly error = signal('');

  protected async onConfirm(): Promise<void> {
    this.deleting.set(true);
    this.error.set('');

    try {
      await firstValueFrom(this.materialsGateway.delete(this.data.material.id));
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
