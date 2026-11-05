import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
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

import { CurrentUserStore } from '../../core/identity/current-user-store';
import { canCorrectRecordsInUse, canManageOrders } from '../../core/identity/permissions';
import { AppOrder, OrdersGateway } from '../../core/orders/orders-gateway';
import {
  AppStandardBom,
  StandardBomsGateway,
} from '../../core/standard-boms/standard-boms-gateway';
import { DataSheet } from '../../ui/data-sheet/data-sheet';
import { EmptyState } from '../../ui/empty-state/empty-state';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { Icon } from '../../ui/icon/icon';
import { PageHeader } from '../../ui/page-header/page-header';
import { AddOrderMiCodeDialog } from './add-order-mi-code-dialog';
import { ConfirmDeleteOrderDialog } from './confirm-delete-order-dialog';
import { OrderFormDialog } from './order-form-dialog';

/**
 * «سفارشات» (issue #101): every order, with the MI codes assigned to it. Every production role reads
 * it; Management and the System Admin define orders and, per row, add an MI code, edit and delete.
 *
 * The row's three actions are plain buttons in the row rather than an overflow menu: they are the
 * page's whole purpose and few enough to show. Each is named by its action and the order
 * («ویرایش ORD-5001»), so rows tell them apart.
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
              [disabled]="standardBomsResource.isLoading()"
              (click)="openDefineDialog()"
            >
              <mat-icon appIcon="add" />تعریف سفارش
            </button>
          }
        </ng-container>
      </app-page-header>

      <app-data-sheet
        heading="فهرست سفارشات"
        [count]="ordersResource.isLoading() || ordersResource.error() ? null : orders().length"
        [loading]="ordersResource.isLoading()"
        loadingLabel="در حال بارگذاری فهرست سفارشات"
      >
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
        } @else {
          <table mat-table [dataSource]="orders()" [trackBy]="trackById">
            <ng-container matColumnDef="orderNumber">
              <th mat-header-cell *matHeaderCellDef>شماره سفارش</th>
              <td mat-cell *matCellDef="let order">
                <bdi class="cell-id">{{ order.orderNumber }}</bdi>
              </td>
            </ng-container>

            <ng-container matColumnDef="miCodes">
              <th mat-header-cell *matHeaderCellDef>کدهای MI</th>
              <td mat-cell *matCellDef="let order">
                <ul class="mi-codes">
                  @for (code of order.miCodes; track code.standardBomId) {
                    <li>
                      <bdi class="cell-id">{{ code.miCode }}</bdi>
                      <span aria-hidden="true"> · </span>
                      <span class="mi-codes__product">{{ code.productName }}</span>
                    </li>
                  }
                </ul>
              </td>
            </ng-container>

            <ng-container matColumnDef="actions" stickyEnd>
              <th mat-header-cell *matHeaderCellDef>
                <span class="visually-hidden">عملیات</span>
              </th>
              <td mat-cell *matCellDef="let order">
                <div class="cell-actions">
                  <button
                    matButton
                    class="button--small"
                    type="button"
                    [attr.aria-label]="'افزودن کد MI به ' + order.orderNumber"
                    (click)="openAddMiCodeDialog(order)"
                  >
                    <mat-icon appIcon="add" />افزودن کد MI
                  </button>
                  <button
                    matButton
                    class="button--small"
                    type="button"
                    [attr.aria-label]="'ویرایش ' + order.orderNumber"
                    (click)="openEditDialog(order)"
                  >
                    <mat-icon appIcon="edit" />ویرایش
                  </button>
                  <button
                    matButton
                    class="button--small button--danger"
                    type="button"
                    [attr.aria-label]="'حذف ' + order.orderNumber"
                    (click)="openDeleteDialog(order)"
                  >
                    <mat-icon appIcon="delete" />حذف
                  </button>
                </div>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="columns()"></tr>
            <tr mat-row *matRowDef="let row; columns: columns()"></tr>
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
  private readonly currentUser = inject(CurrentUserStore);
  private readonly dialog = inject(MatDialog);

  // `read: ElementRef` — on a `matButton` the template reference names the component.
  private readonly defineButton = viewChild('defineButton', { read: ElementRef<HTMLElement> });

  protected readonly canManage = computed(() => canManageOrders(this.currentUser.role()));

  protected readonly columns = computed(() =>
    this.canManage() ? ['orderNumber', 'miCodes', 'actions'] : ['orderNumber', 'miCodes'],
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

  /** The orders, kept on screen while a re-read is in flight; none in an error state. */
  protected readonly orders = computed<AppOrder[]>(() =>
    this.ordersResource.hasValue() ? this.ordersResource.value() : [],
  );

  protected readonly forbidden = computed(() => {
    const error = this.ordersResource.error();
    return error instanceof HttpErrorResponse && error.status === 403;
  });

  protected readonly trackById = (_: number, order: AppOrder) => order.id;

  private standardBoms(): readonly AppStandardBom[] {
    return this.standardBomsResource.hasValue() ? this.standardBomsResource.value() : [];
  }

  protected openDefineDialog(): void {
    this.dialog
      .open(OrderFormDialog, { data: { mode: 'create', standardBoms: this.standardBoms() } })
      .afterClosed()
      .subscribe((saved) => this.reloadIf(saved));
  }

  protected openEditDialog(order: AppOrder): void {
    this.dialog
      .open(OrderFormDialog, {
        data: { mode: 'edit', order, standardBoms: this.standardBoms() },
      })
      .afterClosed()
      .subscribe((saved) => this.reloadIf(saved));
  }

  protected openAddMiCodeDialog(order: AppOrder): void {
    this.dialog
      .open(AddOrderMiCodeDialog, { data: { order, standardBoms: this.standardBoms() } })
      .afterClosed()
      .subscribe((saved) => this.reloadIf(saved));
  }

  /** The System Admin's delete of an order in use takes its daily BOMs too (issue #101), so the
   * confirmation says so; anyone else is refused by the API, and the dialog says that instead. */
  protected openDeleteDialog(order: AppOrder): void {
    const deletesDailyBoms =
      canCorrectRecordsInUse(this.currentUser.role()) && order.dailyBomCount > 0;
    this.dialog
      .open(ConfirmDeleteOrderDialog, { data: { order, deletesDailyBoms } })
      .afterClosed()
      .subscribe((deleted) => {
        if (deleted) {
          this.ordersResource.reload();
          // The row and its button go with the order, so focus goes to «تعریف سفارش».
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
