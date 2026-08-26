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
import { Router } from '@angular/router';

import { AuthGateway } from '../../core/identity/auth-gateway';
import { AppProduct, ProductsGateway } from '../../core/products/products-gateway';
import {
  AppStandardBom,
  StandardBomsGateway,
} from '../../core/standard-boms/standard-boms-gateway';
import { ConfirmDeleteStandardBomDialog } from './confirm-delete-standard-bom-dialog';
import { StandardBomFormDialog } from './standard-bom-form-dialog';

const DISPLAYED_COLUMNS = ['miCode', 'brand', 'product', 'standardLength', 'active', 'actions'];

/**
 * A minimal browse view — enough to pick a Standard BOM to edit or delete. Filtering, exporting and
 * every other "browse the whole catalogue" concern belongs to `bom-reporting`, a separate,
 * not-yet-built feature area; this page's only job is the registration/edit/delete workflow.
 */
@Component({
  selector: 'app-standard-boms-page',
  imports: [
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
        <h1>مدیریت آنالیز های استاندارد</h1>
        <div class="header-actions">
          @if (!forbidden()) {
            <button matButton="filled" type="button" (click)="openCreateDialog()">
              افزودن آنالیز استاندارد
            </button>
          }
          <button matButton type="button" (click)="logout()">خروج از سیستم</button>
        </div>
      </div>

      @if (loading()) {
        <mat-progress-bar
          mode="indeterminate"
          aria-label="در حال بارگذاری فهرست آنالیز های استاندارد"
        />
      } @else if (forbidden()) {
        <p role="alert" class="form-error">شما دسترسی لازم برای مشاهده این بخش را ندارید.</p>
      } @else if (standardBomsResource.error()) {
        <div class="stack--tight">
          <p role="alert" class="form-error">فهرست آنالیز های استاندارد بارگذاری نشد.</p>
          <button matButton type="button" (click)="standardBomsResource.reload()">
            تلاش دوباره
          </button>
        </div>
      } @else if (rows().length === 0) {
        <p>هیچ آنالیز استانداردی ثبت نشده است.</p>
      } @else {
        <div class="table-scroll">
          <table mat-table [dataSource]="rows()">
            <ng-container matColumnDef="miCode">
              <th mat-header-cell *matHeaderCellDef>کد MI</th>
              <td mat-cell *matCellDef="let standardBom">{{ standardBom.miCode }}</td>
            </ng-container>

            <ng-container matColumnDef="brand">
              <th mat-header-cell *matHeaderCellDef>برند</th>
              <td mat-cell *matCellDef="let standardBom">{{ standardBom.brand }}</td>
            </ng-container>

            <ng-container matColumnDef="product">
              <th mat-header-cell *matHeaderCellDef>محصول</th>
              <td mat-cell *matCellDef="let standardBom">
                {{ productNameById().get(standardBom.productId) ?? '—' }}
              </td>
            </ng-container>

            <ng-container matColumnDef="standardLength">
              <th mat-header-cell *matHeaderCellDef>متراژ استاندارد</th>
              <td mat-cell *matCellDef="let standardBom">{{ standardBom.standardLength }}</td>
            </ng-container>

            <ng-container matColumnDef="active">
              <th mat-header-cell *matHeaderCellDef>فعال بودن</th>
              <td mat-cell *matCellDef="let standardBom">
                {{ standardBom.active ? 'فعال' : 'غیرفعال' }}
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef>عملیات</th>
              <td mat-cell *matCellDef="let standardBom">
                <button
                  matButton
                  type="button"
                  [attr.aria-label]="'ویرایش ' + standardBom.miCode"
                  (click)="openEditDialog(standardBom)"
                >
                  ویرایش
                </button>
                <button
                  matButton
                  type="button"
                  [attr.aria-label]="'حذف ' + standardBom.miCode"
                  (click)="openDeleteDialog(standardBom)"
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
  styleUrl: './standard-boms-page.scss',
})
export class StandardBomsPage {
  private readonly standardBomsGateway = inject(StandardBomsGateway);
  private readonly productsGateway = inject(ProductsGateway);
  private readonly authGateway = inject(AuthGateway);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  protected readonly displayedColumns = DISPLAYED_COLUMNS;

  protected readonly standardBomsResource = rxResource({
    stream: () => this.standardBomsGateway.list(),
    defaultValue: [] as AppStandardBom[],
  });

  /**
   * The product picker inside the create/edit dialog needs every product's *current* composition —
   * see `standard-bom-form-dialog.ts` — and this page's own "محصول" column needs each BOM's product
   * name, so both share the one fetch rather than each dialog opening fetching its own copy.
   */
  protected readonly productsResource = rxResource({
    stream: () => this.productsGateway.list(),
    defaultValue: [] as AppProduct[],
  });

  protected readonly loading = computed(
    () => this.standardBomsResource.isLoading() || this.productsResource.isLoading(),
  );

  /** Typed separately from `standardBomsResource.value()` — the table's row context otherwise infers `any`. */
  protected readonly rows = computed<AppStandardBom[]>(() => this.standardBomsResource.value());

  protected readonly productNameById = computed(
    () => new Map(this.productsResource.value().map((product) => [product.id, product.name])),
  );

  /**
   * The API has no "who am I" endpoint, so the frontend cannot know the caller's role ahead of
   * time — a 403 from the one call this page makes is what tells it access was denied, rather than
   * a client-side role check with nothing server-side to back it.
   */
  protected readonly forbidden = computed(() => {
    const error = this.standardBomsResource.error();
    return error instanceof HttpErrorResponse && error.status === 403;
  });

  protected openCreateDialog(): void {
    this.dialog
      .open(StandardBomFormDialog, {
        data: { mode: 'create', products: this.productsResource.value() },
      })
      .afterClosed()
      .subscribe((registered) => {
        if (registered) {
          this.standardBomsResource.reload();
        }
      });
  }

  protected openEditDialog(standardBom: AppStandardBom): void {
    this.dialog
      .open(StandardBomFormDialog, {
        data: { mode: 'edit', standardBom, products: this.productsResource.value() },
      })
      .afterClosed()
      .subscribe((edited) => {
        if (edited) {
          this.standardBomsResource.reload();
        }
      });
  }

  protected openDeleteDialog(standardBom: AppStandardBom): void {
    this.dialog
      .open(ConfirmDeleteStandardBomDialog, { data: { standardBom } })
      .afterClosed()
      .subscribe((deleted) => {
        if (deleted) {
          this.standardBomsResource.reload();
        }
      });
  }

  protected logout(): void {
    this.authGateway.logout();
    this.router.navigateByUrl('/login');
  }
}
