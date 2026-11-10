import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

import { formatPersianNumber } from '../../core/i18n/persian-numerals';
import { AppOrder } from '../../core/orders/orders-gateway';
import { Icon } from '../../ui/icon/icon';
import { PersianNumberPipe } from '../../ui/persian-number/persian-number-pipe';

let nextPanelId = 0;

/** Why Management can't edit or delete an order with daily BOMs — said before they try. */
export function orderInUseReason(dailyBomCount: number): string {
  return (
    `این سفارش در ${formatPersianNumber(dailyBomCount)} آنالیز روزانه ثبت شده است؛ ` +
    'ویرایش و حذف آن ممکن نیست. افزودن کد MI همچنان ممکن است.'
  );
}

/**
 * The selected order's details on the «سفارشات» page (issue #111): a region named by its heading
 * «جزئیات سفارش <number>», every MI code with its product, the daily-BOM count, and — for those
 * who may write — the order's actions, which used to sit in every row.
 *
 * The dependency rule (issue #94) shows before the attempt: for anyone but the System Admin, an
 * order with daily BOMs has «ویرایش» and «حذف» disabled, with the reason beside them and tied to
 * both by `aria-describedby`. They stay focusable (`disabledInteractive`), so a keyboard or screen
 * reader user reaches the reason through the button; a click on one asks for nothing. The System
 * Admin's exception (issue #110) leaves both open: the edit form then locks the MI codes, and the
 * delete confirmation counts the daily BOMs that go with the order.
 */
@Component({
  selector: 'app-order-details-panel',
  imports: [Icon, MatButton, MatIcon, PersianNumberPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="order-details" [attr.aria-labelledby]="headingId">
      <div class="order-details__head">
        <h2 #heading class="order-details__title" tabindex="-1" [id]="headingId">
          جزئیات سفارش <bdi>{{ order().orderNumber }}</bdi>
        </h2>
        <button matButton type="button" class="button--small" (click)="closed.emit()">
          <mat-icon appIcon="close" />بستن جزئیات
        </button>
      </div>

      <dl class="order-details__facts">
        <div>
          <dt>تعداد کد MI</dt>
          &ngsp;
          <dd>{{ order().miCodes.length | persianNumber }}</dd>
        </div>
        <div>
          <dt>آنالیز روزانه</dt>
          &ngsp;
          <dd>{{ order().dailyBomCount | persianNumber }}</dd>
        </div>
      </dl>

      <h3 class="order-details__subtitle" [id]="codesHeadingId">کدهای MI</h3>
      <ul class="order-details__codes" [attr.aria-labelledby]="codesHeadingId">
        @for (code of order().miCodes; track code.standardBomId) {
          <li>
            <bdi class="cell-id">{{ code.miCode }}</bdi
            >&ngsp;
            <span class="order-details__product">{{ code.productName }}</span>
          </li>
        }
      </ul>

      @if (canManage()) {
        <div class="order-details__actions" role="group" aria-label="عملیات سفارش">
          <button matButton="outlined" type="button" (click)="addMiCode.emit(order())">
            <mat-icon appIcon="add" />افزودن کد MI
          </button>
          <button
            matButton="outlined"
            type="button"
            disabledInteractive
            [disabled]="locked()"
            [attr.aria-describedby]="locked() ? reasonId : null"
            (click)="locked() || edit.emit(order())"
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
            (click)="locked() || deleteOrder.emit(order())"
          >
            <mat-icon appIcon="delete" />حذف
          </button>
        </div>
        @if (locked()) {
          <p class="order-details__reason" [id]="reasonId">
            {{ reason() }}
          </p>
        }
      }
    </section>
  `,
  styleUrl: './order-details-panel.scss',
})
export class OrderDetailsPanel {
  readonly order = input.required<AppOrder>();
  /** Management and the System Admin (`canManageOrders`). */
  readonly canManage = input(false);
  /** The System Admin (`canCorrectRecordsInUse`), whom an order's daily BOMs don't stop. */
  readonly canCorrectRecordsInUse = input(false);

  readonly addMiCode = output<AppOrder>();
  readonly edit = output<AppOrder>();
  readonly deleteOrder = output<AppOrder>();
  readonly closed = output<void>();

  private readonly id = nextPanelId++;
  protected readonly headingId = `order-details-heading-${this.id}`;
  protected readonly codesHeadingId = `order-details-codes-${this.id}`;
  protected readonly reasonId = `order-details-reason-${this.id}`;

  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');

  /** Whether the order's daily BOMs bar this role from editing and deleting it. */
  protected readonly locked = computed(
    () => !this.canCorrectRecordsInUse() && this.order().dailyBomCount > 0,
  );

  protected readonly reason = computed(() => orderInUseReason(this.order().dailyBomCount));

  /** Called by the page as the panel opens on an order, so focus follows the visitor's choice. */
  focusHeading(): void {
    this.heading().nativeElement.focus();
  }
}
