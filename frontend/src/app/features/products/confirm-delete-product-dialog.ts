import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
} from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

import { AppProduct, ProductsGateway } from '../../core/products/products-gateway';
import { ConfirmHead } from '../../ui/confirm-head/confirm-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
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
  imports: [ConfirmHead, ErrorBanner, MatButton, MatDialogActions, MatDialogContent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-confirm-head heading="حذف محصول">
      محصول «{{ data.product.name }}» حذف می‌شود. این کار قابل بازگشت نیست.
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
        حذف محصول
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
