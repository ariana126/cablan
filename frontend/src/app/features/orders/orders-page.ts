import { HttpErrorResponse } from '@angular/common/http';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { form, FormField } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatOption, MatSelect } from '@angular/material/select';
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
import { OrderDetailsPanel } from './order-details-panel';
import {
  filterOrders,
  hasActiveFilters,
  NO_ORDER_FILTERS,
  OrderFilters,
  orderProducts,
  productOptions,
} from './order-filters';
import { OrderFormDialog } from './order-form-dialog';

const RESET_LABEL = 'پاک کردن جست‌وجو و فیلترها';

/**
 * «سفارشات» (issues #101, #111): every order, searchable and filterable in the browser, with the
 * chosen order's details — and, for Management and the System Admin, its actions — in a panel
 * beside the list (below it on a narrow screen).
 *
 * The list holds the whole answer of `GET /orders`, so the search («جست‌وجوی سفارش») and the two
 * filters («محصول», «آنالیز روزانه») narrow it client-side, combined with AND (`order-filters.ts`).
 * Rows carry no actions: each order number is a button «جزئیات سفارش <n>» that selects the order;
 * a click anywhere on the row lands on it too (its hit area is stretched over the row, so the
 * keyboard and the pointer share one control). The panel shows the selected order **by id**, so
 * after a change re-reads the list it shows the order as it now is, and closes once it is gone.
 */
@Component({
  selector: 'app-orders-page',
  imports: [
    DataSheet,
    EmptyState,
    ErrorBanner,
    FormField,
    Icon,
    MatButton,
    MatCell,
    MatCellDef,
    MatColumnDef,
    MatFormField,
    MatHeaderCell,
    MatHeaderCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatIcon,
    MatLabel,
    MatOption,
    MatRow,
    MatRowDef,
    MatSelect,
    MatTable,
    OrderDetailsPanel,
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

      <div class="orders-layout">
        <div class="orders-layout__grid" [class.orders-layout__grid--split]="selected()">
          <app-data-sheet
            heading="فهرست سفارشات"
            [count]="ordersResource.isLoading() || ordersResource.error() ? null : visible().length"
            [loading]="ordersResource.isLoading()"
            loadingLabel="در حال بارگذاری فهرست سفارشات"
          >
            @if (orders().length > 0) {
              <app-table-search
                sheetSearch
                label="جست‌وجوی سفارش"
                [value]="filters().query"
                (valueChange)="setQuery($event)"
              />
            }
            @if (orders().length > 0) {
              <div sheetFilters class="order-filters">
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>محصول</mat-label>
                  <mat-select [formField]="filtersForm.productId">
                    <mat-option value="">همه محصولات</mat-option>
                    @for (product of products(); track product.id) {
                      <mat-option [value]="product.id">{{ product.name }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>آنالیز روزانه</mat-label>
                  <mat-select [formField]="filtersForm.dailyBoms">
                    <mat-option value="all">همه</mat-option>
                    <mat-option value="with">دارای آنالیز روزانه</mat-option>
                    <mat-option value="without">بدون آنالیز روزانه</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>
            }
            <!-- Only while it would change something and the list has rows: with no match, the
                 empty state offers the same reset, and two buttons of one name would be ambiguous. -->
            @if (filtering() && visible().length > 0) {
              <button sheetActions matButton type="button" (click)="resetFilters()">
                <mat-icon appIcon="clear" />{{ resetLabel }}
              </button>
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
                message="هیچ سفارشی با این جست‌وجو و فیلترها پیدا نشد."
                [actionLabel]="resetLabel"
                (action)="resetFilters()"
              />
            } @else {
              <table mat-table [dataSource]="visible()" [trackBy]="trackById">
                <ng-container matColumnDef="orderNumber">
                  <th mat-header-cell *matHeaderCellDef>شماره سفارش</th>
                  <td mat-cell *matCellDef="let order">
                    <button
                      matButton
                      type="button"
                      class="button--small order-select"
                      [attr.aria-label]="'جزئیات سفارش ' + order.orderNumber"
                      [attr.aria-current]="order.id === selectedId() ? 'true' : null"
                      (click)="select(order, $event)"
                    >
                      <mat-icon [appIcon]="order.id === selectedId() ? 'check' : 'details'" /><bdi
                        class="cell-id"
                        >{{ order.orderNumber }}</bdi
                      >
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

                <ng-container matColumnDef="dailyBomCount">
                  <th mat-header-cell *matHeaderCellDef>
                    <span class="cell-end">آنالیز روزانه</span>
                  </th>
                  <td mat-cell *matCellDef="let order">
                    <span class="cell-end">{{ order.dailyBomCount | persianNumber }}</span>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="columns"></tr>
                <tr
                  mat-row
                  *matRowDef="let row; columns: columns"
                  [class.order-row--selected]="row.id === selectedId()"
                ></tr>
              </table>
            }
          </app-data-sheet>

          @if (selected(); as order) {
            <app-order-details-panel
              class="orders-layout__details"
              [order]="order"
              [canManage]="canManage()"
              [canCorrectRecordsInUse]="correctsRecordsInUse()"
              (addMiCode)="openAddMiCodeDialog($event)"
              (edit)="openEditDialog($event)"
              (deleteOrder)="openDeleteDialog($event)"
              (closed)="closeDetails()"
            />
          }
        </div>
      </div>
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
  private readonly injector = inject(Injector);

  // `read: ElementRef` — on a `matButton` the template reference names the component.
  private readonly defineButton = viewChild('defineButton', { read: ElementRef<HTMLElement> });
  private readonly detailsPanel = viewChild(OrderDetailsPanel);

  protected readonly resetLabel = RESET_LABEL;
  protected readonly columns = ['orderNumber', 'products', 'miCodeCount', 'dailyBomCount'];
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

  protected readonly filters = signal<OrderFilters>(NO_ORDER_FILTERS);
  protected readonly filtersForm = form(this.filters);

  protected readonly products = computed(() => productOptions(this.orders()));
  protected readonly visible = computed(() => filterOrders(this.orders(), this.filters()));
  protected readonly filtering = computed(() => hasActiveFilters(this.filters()));

  protected readonly selectedId = signal<string | null>(null);
  /** The selected order as the list now has it; `undefined` once it is gone. */
  protected readonly selected = computed(() =>
    this.orders().find((order) => order.id === this.selectedId()),
  );

  /** The order-number button that opened the panel, where focus returns when it closes. */
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

  protected setQuery(query: string): void {
    this.filters.update((filters) => ({ ...filters, query }));
  }

  protected resetFilters(): void {
    this.filters.set(NO_ORDER_FILTERS);
  }

  protected select(order: AppOrder, event: Event): void {
    this.opener = event.currentTarget as HTMLElement;
    this.selectedId.set(order.id);
    afterNextRender(() => this.detailsPanel()?.focusHeading(), { injector: this.injector });
  }

  protected closeDetails(): void {
    this.selectedId.set(null);
    if (this.opener?.isConnected) {
      this.opener.focus();
    }
    this.opener = null;
  }

  protected openDefineDialog(): void {
    this.dialog
      .open(OrderFormDialog, { data: { mode: 'create', miCodeOptions: this.miCodeOptions() } })
      .afterClosed()
      .subscribe((saved) => this.reloadIf(saved));
  }

  protected openEditDialog(order: AppOrder): void {
    this.dialog
      .open(OrderFormDialog, {
        data: { mode: 'edit', order, miCodeOptions: this.miCodeOptions() },
      })
      .afterClosed()
      .subscribe((saved) => this.reloadIf(saved));
  }

  protected openAddMiCodeDialog(order: AppOrder): void {
    this.dialog
      .open(AddOrderMiCodeDialog, { data: { order, miCodeOptions: this.miCodeOptions() } })
      .afterClosed()
      .subscribe((saved) => this.reloadIf(saved));
  }

  /** The System Admin's delete of an order in use takes its daily BOMs too (issue #101), so the
   * confirmation counts them; anyone else never gets here for such an order (the panel disables
   * «حذف»), and the API refuses them if a daily BOM was registered meanwhile. */
  protected openDeleteDialog(order: AppOrder): void {
    const deletesDailyBoms = this.correctsRecordsInUse() && order.dailyBomCount > 0;
    this.dialog
      .open(ConfirmDeleteOrderDialog, { data: { order, deletesDailyBoms } })
      .afterClosed()
      .subscribe((deleted) => {
        if (deleted) {
          this.selectedId.set(null);
          this.opener = null;
          this.ordersResource.reload();
          // The panel and its button go with the order, so focus goes to «تعریف سفارش».
          this.defineButton()?.nativeElement.focus();
        }
      });
  }

  private reloadIf(saved: boolean | undefined): void {
    if (saved) {
      this.ordersResource.reload();
    }
  }
}
