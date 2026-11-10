import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  Signal,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';

import { formatPersianNumber } from '../../core/i18n/persian-numerals';
import { AppOrder } from '../../core/orders/orders-gateway';
import { DialogHead } from '../../ui/dialog-head/dialog-head';
import { Icon } from '../../ui/icon/icon';

let nextDialogId = 0;

/** Why Management can't edit or delete an order with daily BOMs — said before they try. */
export function orderInUseReason(dailyBomCount: number): string {
  return (
    `این سفارش در ${formatPersianNumber(dailyBomCount)} آنالیز روزانه ثبت شده است؛ ` +
    'ویرایش و حذف آن ممکن نیست. افزودن کد MI همچنان ممکن است.'
  );
}

export interface OrderDetailsDialogData {
  /** The order as the page's list now has it; `undefined` once it is gone. */
  readonly order: Signal<AppOrder | undefined>;
  /** Management and the System Admin (`canManageOrders`). */
  readonly canManage: boolean;
  /** The System Admin (`canCorrectRecordsInUse`), whom an order's daily BOMs don't stop. */
  readonly canCorrectRecordsInUse: boolean;
}

/** An action the visitor chose in the details; the page opens its own dialog for it. */
export type OrderAction = 'addMiCode' | 'edit' | 'delete';

/** What the dialog closes with when an action was chosen — nothing when merely dismissed. */
export interface OrderDetailsChoice {
  readonly action: OrderAction;
  readonly order: AppOrder;
}

/**
 * One order's details on the «سفارشات» page (issue #114, a modal since then; issue #111's panel
 * before): headed «جزئیات سفارش <number>», every MI code beside its product, and — for those who may
 * write — the order's actions in the footer.
 *
 * An action closes this dialog with the choice, and the page opens that action's own dialog: one
 * dialog at a time, so a form's fields are never ambiguous between two open dialogs. The page
 * reopens the details afterwards, unless the order was deleted. The order is read through a signal
 * over the page's list, so after a re-read it shows the order as it now is, and closes itself once
 * the order is gone.
 *
 * The dependency rule (issue #94) shows before the attempt: for anyone but the System Admin, an
 * order with daily BOMs has «ویرایش» and «حذف» disabled, with the reason beside them and tied to
 * both by `aria-describedby`. They stay focusable (`disabledInteractive`), so a keyboard or screen
 * reader user reaches the reason through the button; a click on one asks for nothing. The System
 * Admin's exception (issue #110) leaves both open.
 */
@Component({
  selector: 'app-order-details-dialog',
  imports: [DialogHead, Icon, MatButton, MatDialogActions, MatDialogContent, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (order(); as shown) {
      <app-dialog-head [heading]="'جزئیات سفارش ' + shown.orderNumber" />

      <!-- Focusable, so a keyboard can scroll a long list of codes on a short screen. -->
      <mat-dialog-content class="order-details" tabindex="0">
        <h3 class="order-details__subtitle" [id]="codesHeadingId">کدهای MI</h3>
        <ul class="order-codes" [attr.aria-labelledby]="codesHeadingId">
          @for (code of shown.miCodes; track code.standardBomId) {
            <li>
              <bdi class="order-codes__code cell-id">{{ code.miCode }}</bdi>
              <span class="order-codes__product">{{ code.productName }}</span>
            </li>
          }
        </ul>

        @if (data.canManage && locked()) {
          <p class="order-details__reason" [id]="reasonId">{{ reason() }}</p>
        }
      </mat-dialog-content>

      @if (data.canManage) {
        <mat-dialog-actions class="dialog-footer order-details__actions">
          <button matButton="outlined" type="button" (click)="choose('addMiCode', shown)">
            <mat-icon appIcon="add" />افزودن کد MI
          </button>
          <button
            matButton="outlined"
            type="button"
            disabledInteractive
            [disabled]="locked()"
            [attr.aria-describedby]="locked() ? reasonId : null"
            (click)="locked() || choose('edit', shown)"
          >
            <mat-icon appIcon="edit" />ویرایش
          </button>
          <button
            matButton
            type="button"
            class="button--danger order-details__delete"
            disabledInteractive
            [disabled]="locked()"
            [attr.aria-describedby]="locked() ? reasonId : null"
            (click)="locked() || choose('delete', shown)"
          >
            <mat-icon appIcon="delete" />حذف
          </button>
        </mat-dialog-actions>
      }
    }
  `,
  styleUrl: './order-details-dialog.scss',
})
export class OrderDetailsDialog {
  protected readonly data = inject<OrderDetailsDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<OrderDetailsDialog, OrderDetailsChoice>>(MatDialogRef);

  private readonly id = nextDialogId++;
  protected readonly codesHeadingId = `order-details-codes-${this.id}`;
  protected readonly reasonId = `order-details-reason-${this.id}`;

  protected readonly order = this.data.order;

  /** Whether the order's daily BOMs bar this role from editing and deleting it. */
  protected readonly locked = computed(
    () => !this.data.canCorrectRecordsInUse && (this.order()?.dailyBomCount ?? 0) > 0,
  );

  protected readonly reason = computed(() => orderInUseReason(this.order()?.dailyBomCount ?? 0));

  constructor() {
    effect(() => {
      if (this.order() === undefined) {
        this.dialogRef.close();
      }
    });
  }

  protected choose(action: OrderAction, order: AppOrder): void {
    this.dialogRef.close({ action, order });
  }
}
