import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatDivider } from '@angular/material/divider';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuContent, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
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

import { ComponentsGateway } from '../../core/components/components-gateway';
import { MaterialsGateway } from '../../core/materials/materials-gateway';
import { AppProduct, ProductsGateway } from '../../core/products/products-gateway';
import { matchesSearch } from '../../core/i18n/search-normalizer';
import { CopyId } from '../../ui/copy-id-button/copy-id';
import { DataSheet } from '../../ui/data-sheet/data-sheet';
import { EmptyState } from '../../ui/empty-state/empty-state';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { PageHeader } from '../../ui/page-header/page-header';
import { TableSearch } from '../../ui/table-search/table-search';
import { ConfirmDeleteProductDialog } from './confirm-delete-product-dialog';
import { ProductFormDialog } from './product-form-dialog';
import { PersianNumberPipe } from '../../ui/persian-number/persian-number-pipe';
import { Icon } from '../../ui/icon/icon';

const DISPLAYED_COLUMNS = ['name', 'componentCount', 'actions'];

@Component({
  selector: 'app-products-page',
  imports: [
    DataSheet,
    EmptyState,
    ErrorBanner,
    Icon,
    MatButton,
    MatCell,
    MatCellDef,
    MatColumnDef,
    MatDivider,
    MatHeaderCell,
    MatHeaderCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatIcon,
    MatIconButton,
    MatMenu,
    MatMenuContent,
    MatMenuItem,
    MatMenuTrigger,
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
        heading="مدیریت محصولات"
        description="هر محصول از چند جز ساخته می‌شود و هر جز از یک یا چند مواد اولیه"
      >
        @if (!forbidden()) {
          <button pageHeaderActions matButton="filled" type="button" (click)="openCreateDialog()">
            <mat-icon>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </mat-icon>
            افزودن محصول
          </button>
        }
      </app-page-header>

      <app-data-sheet
        heading="فهرست محصولات"
        [count]="
          productsResource.isLoading() || productsResource.error() ? null : filteredRows().length
        "
        [loading]="productsResource.isLoading()"
        loadingLabel="در حال بارگذاری فهرست محصولات"
      >
        @if (rows().length > 0) {
          <app-table-search sheetSearch label="جستجوی نام محصول" [(value)]="query" />
        }

        @if (productsResource.isLoading()) {
          <!-- The sheet's progress bar says it; nothing to draw until the answer arrives. -->
        } @else if (forbidden()) {
          <app-error-banner message="شما دسترسی لازم برای مشاهده این بخش را ندارید." />
        } @else if (productsResource.error()) {
          <app-error-banner
            message="فهرست محصولات بارگذاری نشد."
            retryLabel="تلاش دوباره"
            (retry)="productsResource.reload()"
          />
        } @else if (rows().length === 0) {
          <app-empty-state message="هیچ محصولی ثبت نشده است." />
        } @else if (filteredRows().length === 0) {
          <app-empty-state
            message="موردی یافت نشد"
            actionLabel="پاک کردن جستجو"
            (action)="query.set('')"
          />
        } @else {
          <table mat-table [dataSource]="filteredRows()">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>نام</th>
              <td mat-cell *matCellDef="let product">{{ product.name }}</td>
            </ng-container>

            <ng-container matColumnDef="componentCount">
              <th mat-header-cell *matHeaderCellDef>
                <span class="cell-end">تعداد اجزا</span>
              </th>
              <td mat-cell *matCellDef="let product">
                <span class="cell-end">{{ product.components.length | persianNumber }}</span>
              </td>
            </ng-container>

            <!-- «ویرایش» is the row's most common action; copying the id and deleting are in the
                 overflow menu — one menu for the table, filled with the row it was opened from. -->
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef>
                <span class="visually-hidden">عملیات</span>
              </th>
              <td mat-cell *matCellDef="let product">
                <div class="cell-actions">
                  <button
                    matButton
                    class="button--small"
                    type="button"
                    [attr.aria-label]="'ویرایش ' + product.name"
                    (click)="openEditDialog(product)"
                  >
                    <mat-icon appIcon="edit" />
                    ویرایش
                  </button>
                  <button
                    matIconButton
                    class="icon-button--small"
                    type="button"
                    [attr.aria-label]="'عملیات بیشتر برای ' + product.name"
                    [matMenuTriggerFor]="rowMenu"
                    [matMenuTriggerData]="{ product }"
                  >
                    <mat-icon>
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <circle cx="12" cy="5" r="1.2" />
                        <circle cx="12" cy="12" r="1.2" />
                        <circle cx="12" cy="19" r="1.2" />
                      </svg>
                    </mat-icon>
                  </button>
                </div>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
          </table>
        }
      </app-data-sheet>

      <mat-menu #rowMenu="matMenu">
        <ng-template matMenuContent let-product="product">
          <button mat-menu-item type="button" (click)="copyId.copy(product.id)">
            <mat-icon>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="9" y="9" width="12" height="12" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </mat-icon>
            <span>کپی شناسه</span>
          </button>
          <mat-divider />
          <button
            mat-menu-item
            class="menu-item--danger"
            type="button"
            (click)="openDeleteDialog(product)"
          >
            <mat-icon>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M4 7h16M10 11v6M14 11v6" />
                <path d="M6 7l1 13h10l1-13M9 7V4h6v3" />
              </svg>
            </mat-icon>
            <span>حذف</span>
          </button>
        </ng-template>
      </mat-menu>
    </div>
  `,
  styleUrl: './products-page.scss',
})
export class ProductsPage {
  private readonly productsGateway = inject(ProductsGateway);
  private readonly componentsGateway = inject(ComponentsGateway);
  private readonly materialsGateway = inject(MaterialsGateway);
  private readonly dialog = inject(MatDialog);
  protected readonly copyId = inject(CopyId);

  protected readonly displayedColumns = DISPLAYED_COLUMNS;

  protected readonly productsResource = rxResource({
    stream: () => this.productsGateway.list(),
    defaultValue: [] as AppProduct[],
  });

  /**
   * The already-registered `components`/`materials` lists the create/edit dialog's pickers are
   * built from — a product's composition can only ever reference a name already registered on one
   * of these (see `product-form-dialog.ts`'s class doc), so this page fetches both once, the same
   * way `BomsPage` fetches `standardBomsResource` purely to feed its own form dialog.
   */
  protected readonly componentsResource = rxResource({
    stream: () => this.componentsGateway.list(),
    defaultValue: [],
  });
  protected readonly materialsResource = rxResource({
    stream: () => this.materialsGateway.list(),
    defaultValue: [],
  });

  /** Typed separately from `productsResource.value()` — the table's row context otherwise infers `any`. */
  protected readonly rows = computed<AppProduct[]>(() =>
    // `value()` throws while the resource is in an error state, and the template reads this before
    // it decides which of loading / error / empty / table to draw.
    this.productsResource.hasValue() ? this.productsResource.value() : [],
  );

  /** What the search box has typed; it narrows the loaded rows, which is all of them — this list is
   * not paged, so there is no page for the search to miss. */
  protected readonly query = signal('');

  protected readonly filteredRows = computed<AppProduct[]>(() =>
    this.rows().filter((product) => matchesSearch(product.name, this.query())),
  );

  /**
   * The API has no "who am I" endpoint, so the frontend cannot know the caller's role ahead of
   * time — a 403 from the one call this page makes is what tells it access was denied, rather than
   * a client-side role check with nothing server-side to back it.
   */
  protected readonly forbidden = computed(() => {
    const error = this.productsResource.error();
    return error instanceof HttpErrorResponse && error.status === 403;
  });

  protected openCreateDialog(): void {
    this.dialog
      .open(ProductFormDialog, {
        data: {
          mode: 'create',
          components: this.componentsResource.value(),
          materials: this.materialsResource.value(),
        },
      })
      .afterClosed()
      .subscribe((registered) => {
        if (registered) {
          this.productsResource.reload();
        }
      });
  }

  protected openEditDialog(product: AppProduct): void {
    this.dialog
      .open(ProductFormDialog, {
        data: {
          mode: 'edit',
          product,
          components: this.componentsResource.value(),
          materials: this.materialsResource.value(),
        },
      })
      .afterClosed()
      .subscribe((edited) => {
        if (edited) {
          this.productsResource.reload();
        }
      });
  }

  protected openDeleteDialog(product: AppProduct): void {
    this.dialog
      .open(ConfirmDeleteProductDialog, { data: { product } })
      .afterClosed()
      .subscribe((deleted) => {
        if (deleted) {
          this.productsResource.reload();
        }
      });
  }
}
