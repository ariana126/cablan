import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import {
  MatCell,
  MatCellDef,
  MatColumnDef,
  MatHeaderCell,
  MatHeaderCellDef,
  MatHeaderRow,
  MatHeaderRowDef,
  MatRow,
  MatRowDef,
  MatTable,
} from '@angular/material/table';
import { Observable } from 'rxjs';

import { CurrentUserStore } from '../../core/identity/current-user-store';
import { canCorrectRecordsInUse, canManageOrders } from '../../core/identity/permissions';
import { AppOrder, OrdersGateway } from '../../core/orders/orders-gateway';
import { AppProduct, ProductsGateway } from '../../core/products/products-gateway';
import {
  AppStandardBom,
  StandardBomsGateway,
} from '../../core/standard-boms/standard-boms-gateway';
import { DataSheet } from '../../ui/data-sheet/data-sheet';
import { EmptyState } from '../../ui/empty-state/empty-state';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { Icon } from '../../ui/icon/icon';
import { PageHeader } from '../../ui/page-header/page-header';
import { PersianNumberPipe } from '../../ui/persian-number/persian-number-pipe';
import { TableSearch } from '../../ui/table-search/table-search';
import { AddOrderMiCodeDialog } from './add-order-mi-code-dialog';
import { ConfirmDeleteOrderDialog } from './confirm-delete-order-dialog';
import { miCodeOptions } from './mi-code-option';
import {
  OrderDetailsChoice,
  OrderDetailsDialog,
  OrderDetailsDialogData,
} from './order-details-dialog';
import { OrderFormDialog } from './order-form-dialog';
import { orderProducts, searchOrders } from './order-search';

/**
 * «سفارشات» (issues #101, #111, #114): every order, searchable in the browser, each opening its
 * details — and, for Management and the System Admin, its actions — in a modal dialog.
 *
 * The list holds the whole answer of `GET /orders`, so the one search box («جست‌وجوی سفارش»,
 * order number or product name) narrows it client-side (`order-search.ts`). Rows carry no actions:
 * each order number is a button «جزئیات سفارش <n>» that opens `OrderDetailsDialog`; a click anywhere
 * on the row lands on it too (its hit area is stretched over the row, so the keyboard and the
 * pointer share one control — never a click handler on the `tr`).
 *
 * One dialog at a time: an action chosen in the details closes them and opens its own dialog; when
 * that closes, the page re-reads if something changed and reopens the details on the same order —
 * read by **id** through a signal over the list, so they show the order as it now is — unless it
 * was deleted. Closing the details leaves the search and its results as they were.
 */
@Component({
  selector: 'app-orders-page',
  imports: [
    DataSheet,
    EmptyState,
    ErrorBanner,
    Icon,
    MatButton,
    MatCell,
    MatCellDef,
    MatColumnDef,
    MatHeaderCell,
    MatHeaderCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatIcon,
    MatRow,
    MatRowDef,
    MatTable,
    PageHeader,
    PersianNumberPipe,
    TableSearch,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack">
      <app-page-header
        heading="سفارشات"
        description="هر سفارش و کدهای MI تخصیص‌یافته به آن؛ آنالیز روزانه فقط با همین کدها ثبت می‌شود"
      >
        <ng-container ngProjectAs="[pageHeaderActions]">
          @if (canManage()) {
            <button
              #defineButton
              matButton="filled"
              type="button"
              [disabled]="optionsLoading()"
              (click)="openDefineDialog()"
            >
              <mat-icon appIcon="add" />تعریف سفارش
            </button>
          }
        </ng-container>
      </app-page-header>

      <app-data-sheet
        heading="فهرست سفارشات"
        [count]="ordersResource.isLoading() || ordersResource.error() ? null : visible().length"
        [loading]="ordersResource.isLoading()"
        loadingLabel="در حال بارگذاری فهرست سفارشات"
      >
        @if (orders().length > 0) {
          <app-table-search sheetSearch label="جست‌وجوی سفارش" [(value)]="query" />
        }

        @if (ordersResource.isLoading() && orders().length === 0) {
          <!-- The sheet's progress bar says it. -->
        } @else if (forbidden()) {
          <app-error-banner message="شما دسترسی لازم برای مشاهده این بخش را ندارید." />
        } @else if (ordersResource.error()) {
          <app-error-banner
            message="فهرست سفارشات بارگذاری نشد."
            retryLabel="تلاش دوباره"
            (retry)="ordersResource.reload()"
          />
        } @else if (orders().length === 0) {
          <app-empty-state message="هیچ سفارشی تعریف نشده است." />
        } @else if (visible().length === 0) {
          <app-empty-state
            message="هیچ سفارشی با این جست‌وجو پیدا نشد."
            actionLabel="پاک کردن جست‌وجو"
            (action)="query.set('')"
          />
        } @else {
          <p class="orders-hint">برای مشاهده جزئیات هر سفارش روی ردیف آن کلیک کنید.</p>
          <table mat-table [dataSource]="visible()" [trackBy]="trackById">
            <ng-container matColumnDef="orderNumber">
              <th mat-header-cell *matHeaderCellDef>شماره سفارش</th>
              <td mat-cell *matCellDef="let order">
                <button
                  matButton
                  type="button"
                  class="button--small order-select"
                  [attr.aria-label]="'جزئیات سفارش ' + order.orderNumber"
                  (click)="openDetails(order.id, $event)"
                >
                  <bdi class="cell-id">{{ order.orderNumber }}</bdi>
                </button>
              </td>
            </ng-container>

            <ng-container matColumnDef="products">
              <th mat-header-cell *matHeaderCellDef>محصول</th>
              <td mat-cell *matCellDef="let order">
                <ul class="products">
                  @for (product of productsOf(order); track product.id) {
                    <li>{{ product.name }}</li>
                  }
                </ul>
              </td>
            </ng-container>

            <ng-container matColumnDef="miCodeCount">
              <th mat-header-cell *matHeaderCellDef>
                <span class="cell-end">تعداد کد MI</span>
              </th>
              <td mat-cell *matCellDef="let order">
                <span class="cell-end">{{ order.miCodes.length | persianNumber }}</span>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns"></tr>
          </table>
        }
      </app-data-sheet>
    </div>
  `,
  styleUrl: './orders-page.scss',
})
export class OrdersPage {
  private readonly ordersGateway = inject(OrdersGateway);
  private readonly standardBomsGateway = inject(StandardBomsGateway);
  private readonly productsGateway = inject(ProductsGateway);
  private readonly currentUser = inject(CurrentUserStore);
  private readonly dialog = inject(MatDialog);

  // `read: ElementRef` — on a `matButton` the template reference names the component.
  private readonly defineButton = viewChild('defineButton', { read: ElementRef<HTMLElement> });

  protected readonly columns = ['orderNumber', 'products', 'miCodeCount'];
  protected readonly productsOf = orderProducts;

  protected readonly canManage = computed(() => canManageOrders(this.currentUser.role()));
  protected readonly correctsRecordsInUse = computed(() =>
    canCorrectRecordsInUse(this.currentUser.role()),
  );

  protected readonly ordersResource = rxResource({
    stream: () => this.ordersGateway.list(),
    defaultValue: [] as AppOrder[],
  });

  /** What «کدهای MI» offers — read only by those who can define or change an order. */
  protected readonly standardBomsResource = rxResource({
    params: () => (this.canManage() ? {} : undefined),
    stream: () => this.standardBomsGateway.list(),
    defaultValue: [] as AppStandardBom[],
  });

  /** The products the MI codes on offer are named by — read only by the same roles. */
  protected readonly productsResource = rxResource({
    params: () => (this.canManage() ? {} : undefined),
    stream: () => this.productsGateway.list(),
    defaultValue: [] as AppProduct[],
  });

  protected readonly optionsLoading = computed(
    () => this.standardBomsResource.isLoading() || this.productsResource.isLoading(),
  );

  /** The orders, kept on screen while a re-read is in flight; none in an error state. */
  protected readonly orders = computed<AppOrder[]>(() =>
    this.ordersResource.hasValue() ? this.ordersResource.value() : [],
  );

  protected readonly query = signal('');
  protected readonly visible = computed(() => searchOrders(this.orders(), this.query()));

  private readonly selectedId = signal<string | null>(null);
  /** The order whose details are open, as the list now has it; `undefined` once it is gone. */
  private readonly selected = computed(() =>
    this.orders().find((order) => order.id === this.selectedId()),
  );

  /** The order-number button the details were opened from, where focus returns at the end. */
  private opener: HTMLElement | null = null;

  protected readonly forbidden = computed(() => {
    const error = this.ordersResource.error();
    return error instanceof HttpErrorResponse && error.status === 403;
  });

  protected readonly trackById = (_: number, order: AppOrder) => order.id;

  private readonly miCodeOptions = computed(() =>
    miCodeOptions(
      this.standardBomsResource.hasValue() ? this.standardBomsResource.value() : [],
      this.productsResource.hasValue() ? this.productsResource.value() : [],
    ),
  );

  protected openDetails(id: string, event: Event): void {
    this.opener = event.currentTarget as HTMLElement;
    this.showDetails(id);
  }

  protected openDefineDialog(): void {
    this.dialog
      .open(OrderFormDialog, { data: { mode: 'create', miCodeOptions: this.miCodeOptions() } })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.ordersResource.reload();
        }
      });
  }

  /** The details of the order `id`, reading it live from the list. */
  private showDetails(id: string): void {
    this.selectedId.set(id);
    const data: OrderDetailsDialogData = {
      order: this.selected,
      canManage: this.canManage(),
      canCorrectRecordsInUse: this.correctsRecordsInUse(),
    };
    this.dialog
      .open<OrderDetailsDialog, OrderDetailsDialogData, OrderDetailsChoice>(OrderDetailsDialog, {
        data,
        // Reopened after an action, the details would otherwise hand focus back to that action's
        // button, which is gone with the dialog it sat in.
        restoreFocus: this.opener?.isConnected ? this.opener : true,
      })
      .afterClosed()
      .subscribe((choice) => (choice ? this.carryOut(choice) : this.selectedId.set(null)));
  }

  /** Opens the chosen action's own dialog; afterwards, back to the order's details. */
  private carryOut({ action, order }: OrderDetailsChoice): void {
    if (action === 'delete') {
      this.confirmDelete(order);
      return;
    }
    this.afterAction(order, this.actionDialog(action, order));
  }

  private actionDialog(action: 'addMiCode' | 'edit', order: AppOrder): Observable<unknown> {
    const options = this.miCodeOptions();
    return action === 'edit'
      ? this.dialog
          .open(OrderFormDialog, { data: { mode: 'edit', order, miCodeOptions: options } })
          .afterClosed()
      : this.dialog
          .open(AddOrderMiCodeDialog, { data: { order, miCodeOptions: options } })
          .afterClosed();
  }

  private afterAction(order: AppOrder, closed: Observable<unknown>): void {
    closed.subscribe((saved) => {
      if (saved) {
        this.ordersResource.reload();
      }
      this.showDetails(order.id);
    });
  }

  /** The System Admin's delete of an order in use takes its daily BOMs too (issue #101), so the
   * confirmation counts them; anyone else never gets here for such an order (the details disable
   * «حذف»), and the API refuses them if a daily BOM was registered meanwhile. */
  private confirmDelete(order: AppOrder): void {
    const deletesDailyBoms = this.correctsRecordsInUse() && order.dailyBomCount > 0;
    this.dialog
      .open(ConfirmDeleteOrderDialog, { data: { order, deletesDailyBoms } })
      .afterClosed()
      .subscribe((deleted) => {
        if (!deleted) {
          this.showDetails(order.id);
          return;
        }
        this.selectedId.set(null);
        this.opener = null;
        this.ordersResource.reload();
        // The order's row and its button go with it, so focus goes to «تعریف سفارش».
        this.defineButton()?.nativeElement.focus();
      });
  }
}
