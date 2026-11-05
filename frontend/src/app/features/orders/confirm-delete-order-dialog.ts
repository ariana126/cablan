import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';

import { AppOrder, OrdersGateway } from '../../core/orders/orders-gateway';
import { PersianNumberPipe } from '../../ui/persian-number/persian-number-pipe';
import { ConfirmHead } from '../../ui/confirm-head/confirm-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { Icon } from '../../ui/icon/icon';
import { mapDeleteOrderError } from './server-errors';

export interface ConfirmDeleteOrderDialogData {
  readonly order: AppOrder;
  /**
   * Whether the delete takes the order's daily BOMs with it: the System Admin's exception (issue
   * #101) for an order in use. Anyone else is refused by the API instead, and told so here.
   */
  readonly deletesDailyBoms: boolean;
}

/** Deleting an order — irreversible, so confirmed in a dialog of its own. */
@Component({
  selector: 'app-confirm-delete-order-dialog',
  imports: [
    ConfirmHead,
    ErrorBanner,
    Icon,
    MatButton,
    MatDialogActions,
    MatDialogContent,
    MatIcon,
    PersianNumberPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-confirm-head heading="حذف سفارش">
      سفارش «<bdi>{{ data.order.orderNumber }}</bdi
      >» حذف می‌شود.
      @if (data.deletesDailyBoms) {
        {{ data.order.dailyBomCount | persianNumber }} آنالیز روزانه ثبت‌شده برای این سفارش هم همراه
        آن حذف می‌شوند.
      }
      این کار قابل بازگشت نیست.
    </app-confirm-head>

    @if (error()) {
      <mat-dialog-content>
        <app-error-banner [message]="error()" />
      </mat-dialog-content>
    }

    <mat-dialog-actions class="dialog-footer">
      <button matButton type="button" cdkFocusInitial (click)="dialogRef.close(false)">
        <mat-icon appIcon="cancel" />انصراف
      </button>
      <button
        matButton="filled"
        class="danger"
        type="button"
        [disabled]="deleting()"
        (click)="onConfirm()"
      >
        <mat-icon appIcon="delete" />حذف
      </button>
    </mat-dialog-actions>
  `,
  styleUrl: './confirm-delete-order-dialog.scss',
})
export class ConfirmDeleteOrderDialog {
  protected readonly dialogRef = inject(MatDialogRef<ConfirmDeleteOrderDialog, boolean>);
  protected readonly data = inject<ConfirmDeleteOrderDialogData>(MAT_DIALOG_DATA);
  private readonly ordersGateway = inject(OrdersGateway);

  protected readonly deleting = signal(false);
  protected readonly error = signal('');

  protected async onConfirm(): Promise<void> {
    this.deleting.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.ordersGateway.delete(this.data.order.id));
      this.dialogRef.close(true);
    } catch (deleteError) {
      this.error.set(mapDeleteOrderError(deleteError));
    } finally {
      this.deleting.set(false);
    }
  }
}
