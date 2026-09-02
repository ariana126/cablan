import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressBar } from '@angular/material/progress-bar';
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

import { AppProduct, ProductsGateway } from '../../core/products/products-gateway';
import { CopyIdButton } from '../../ui/copy-id-button/copy-id-button';
import { ConfirmDeleteProductDialog } from './confirm-delete-product-dialog';
import { ProductFormDialog } from './product-form-dialog';
import { PersianNumberPipe } from '../../ui/persian-number/persian-number-pipe';

const DISPLAYED_COLUMNS = ['copyId', 'name', 'componentCount', 'actions'];

@Component({
  selector: 'app-products-page',
  imports: [
    PersianNumberPipe,
    CopyIdButton,
    MatButton,
    MatCell,
    MatCellDef,
    MatColumnDef,
    MatHeaderCell,
    MatHeaderCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatProgressBar,
    MatRow,
    MatRowDef,
    MatTable,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack">
      <div class="header">
        <h1>مدیریت محصولات</h1>
        <div class="header-actions">
          @if (!forbidden()) {
            <button matButton="filled" type="button" (click)="openCreateDialog()">
              افزودن محصول
            </button>
          }
        </div>
      </div>

      @if (productsResource.isLoading()) {
        <mat-progress-bar mode="indeterminate" aria-label="در حال بارگذاری فهرست محصولات" />
      } @else if (forbidden()) {
        <p role="alert" class="form-error">شما دسترسی لازم برای مشاهده این بخش را ندارید.</p>
      } @else if (productsResource.error()) {
        <div class="stack--tight">
          <p role="alert" class="form-error">فهرست محصولات بارگذاری نشد.</p>
          <button matButton type="button" (click)="productsResource.reload()">تلاش دوباره</button>
        </div>
      } @else if (rows().length === 0) {
        <p>هیچ محصولی ثبت نشده است.</p>
      } @else {
        <div class="table-scroll">
          <table mat-table [dataSource]="rows()">
            <!--
              A utility column, not a business one: it carries the row's id without ever showing it.
              It leads the row because the document is dir="rtl", which puts the first column at the
              visual right edge — the row's own margin, clear of the data and of the actions at the
              far end. The header is there for a screen reader only; a visible label would be louder
              than the button it names.
            -->
            <ng-container matColumnDef="copyId">
              <th mat-header-cell *matHeaderCellDef>
                <span class="visually-hidden">کپی شناسه</span>
              </th>
              <td mat-cell *matCellDef="let product">
                <app-copy-id-button [entityId]="product.id" [entityName]="product.name" />
              </td>
            </ng-container>

            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>نام</th>
              <td mat-cell *matCellDef="let product">{{ product.name }}</td>
            </ng-container>

            <ng-container matColumnDef="componentCount">
              <th mat-header-cell *matHeaderCellDef>تعداد اجزا</th>
              <td mat-cell *matCellDef="let product">
                {{ product.components.length | persianNumber }}
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef>عملیات</th>
              <td mat-cell *matCellDef="let product">
                <button
                  matButton
                  type="button"
                  [attr.aria-label]="'ویرایش ' + product.name"
                  (click)="openEditDialog(product)"
                >
                  ویرایش
                </button>
                <button
                  matButton
                  type="button"
                  [attr.aria-label]="'حذف ' + product.name"
                  (click)="openDeleteDialog(product)"
                >
                  حذف
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
          </table>
        </div>
      }
    </div>
  `,
  styleUrl: './products-page.scss',
})
export class ProductsPage {
  private readonly productsGateway = inject(ProductsGateway);
  private readonly dialog = inject(MatDialog);

  protected readonly displayedColumns = DISPLAYED_COLUMNS;

  protected readonly productsResource = rxResource({
    stream: () => this.productsGateway.list(),
    defaultValue: [] as AppProduct[],
  });

  /** Typed separately from `productsResource.value()` — the table's row context otherwise infers `any`. */
  protected readonly rows = computed<AppProduct[]>(() => this.productsResource.value());

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
      .open(ProductFormDialog, { data: { mode: 'create' } })
      .afterClosed()
      .subscribe((registered) => {
        if (registered) {
          this.productsResource.reload();
        }
      });
  }

  protected openEditDialog(product: AppProduct): void {
    this.dialog
      .open(ProductFormDialog, { data: { mode: 'edit', product } })
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
