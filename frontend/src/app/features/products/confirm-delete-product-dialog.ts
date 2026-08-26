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

import { AppProduct, ProductsGateway } from '../../core/products/products-gateway';
import { mapDeleteError } from './server-errors';

export interface ConfirmDeleteProductDialogData {
  readonly product: AppProduct;
}

/**
 * A blocking decision, per the design system's dialog-vs-snackbar guidance: deleting a product is
 * destructive and has to be acknowledged, not merely undoable after the fact. Deleting a product
 * only removes its own composition rows — the master `Component`/`Material` rows it was built from
 * outlive it, per `backend/src/modules/products/CLAUDE.md`.
 */
@Component({
  selector: 'app-confirm-delete-product-dialog',
  imports: [MatButton, MatDialogActions, MatDialogContent, MatDialogTitle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>حذف محصول</h2>

    <mat-dialog-content class="stack">
      <p>محصول «{{ data.product.name }}» حذف می‌شود. این کار قابل بازگشت نیست.</p>
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
  styleUrl: './confirm-delete-product-dialog.scss',
})
export class ConfirmDeleteProductDialog {
  private readonly dialogRef = inject(MatDialogRef<ConfirmDeleteProductDialog, boolean>);
  protected readonly data = inject<ConfirmDeleteProductDialogData>(MAT_DIALOG_DATA);
  private readonly productsGateway = inject(ProductsGateway);

  protected readonly deleting = signal(false);
  protected readonly error = signal('');

  protected async onConfirm(): Promise<void> {
    this.deleting.set(true);
    this.error.set('');

    try {
      await firstValueFrom(this.productsGateway.delete(this.data.product.id));
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
