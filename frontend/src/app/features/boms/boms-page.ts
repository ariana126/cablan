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

import { AppBom, BomsGateway } from '../../core/boms/boms-gateway';
import { AuthGateway } from '../../core/identity/auth-gateway';
import {
  AppStandardBom,
  StandardBomsGateway,
} from '../../core/standard-boms/standard-boms-gateway';
import { BomFormDialog } from './bom-form-dialog';
import { ConfirmDeleteBomDialog } from './confirm-delete-bom-dialog';

const DISPLAYED_COLUMNS = ['standardBomMiCode', 'orderNumber', 'trackingNumber', 'actions'];

/**
 * A minimal browse view — enough to pick a daily BOM to edit or delete. Filtering, exporting and
 * every other "browse the whole catalogue" concern belongs to `bom-reporting`, a separate,
 * not-yet-built feature area; this page's only job is the registration/edit/delete workflow.
 *
 * Unlike `standard-boms-page`, listing carries no role restriction — any authenticated user may
 * browse (see `BomsGateway`'s own doc comment) — so there is no page-wide "forbidden" state to
 * compute from a 403 here. A disallowed role only ever surfaces from an actual register/edit/delete
 * attempt, and `bom-form-dialog`/`confirm-delete-bom-dialog` are what turn that 403 into an
 * access-denied message.
 */
@Component({
  selector: 'app-boms-page',
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
        <h1>مدیریت آنالیز های روزانه</h1>
        <div class="header-actions">
          <button matButton="filled" type="button" (click)="openCreateDialog()">
            افزودن آنالیز روزانه
          </button>
          <button matButton type="button" (click)="logout()">خروج از سیستم</button>
        </div>
      </div>

      @if (loading()) {
        <mat-progress-bar
          mode="indeterminate"
          aria-label="در حال بارگذاری فهرست آنالیز های روزانه"
        />
      } @else if (bomsResource.error()) {
        <div class="stack--tight">
          <p role="alert" class="form-error">فهرست آنالیز های روزانه بارگذاری نشد.</p>
          <button matButton type="button" (click)="bomsResource.reload()">تلاش دوباره</button>
        </div>
      } @else if (rows().length === 0) {
        <p>هیچ آنالیز روزانه‌ای ثبت نشده است.</p>
      } @else {
        <div class="table-scroll">
          <table mat-table [dataSource]="rows()">
            <ng-container matColumnDef="standardBomMiCode">
              <th mat-header-cell *matHeaderCellDef>کد MI آنالیز استاندارد</th>
              <td mat-cell *matCellDef="let bom">
                {{ standardBomMiCodeById().get(bom.standardBomId) ?? '—' }}
              </td>
            </ng-container>

            <ng-container matColumnDef="orderNumber">
              <th mat-header-cell *matHeaderCellDef>شماره سفارش</th>
              <td mat-cell *matCellDef="let bom">{{ bom.orderNumber }}</td>
            </ng-container>

            <ng-container matColumnDef="trackingNumber">
              <th mat-header-cell *matHeaderCellDef>شماره ردیابی</th>
              <td mat-cell *matCellDef="let bom">{{ bom.trackingNumber }}</td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef>عملیات</th>
              <td mat-cell *matCellDef="let bom">
                <button
                  matButton
                  type="button"
                  [attr.aria-label]="'ویرایش ' + bom.orderNumber"
                  (click)="openEditDialog(bom)"
                >
                  ویرایش
                </button>
                <button
                  matButton
                  type="button"
                  [attr.aria-label]="'حذف ' + bom.orderNumber"
                  (click)="openDeleteDialog(bom)"
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
  styleUrl: './boms-page.scss',
})
export class BomsPage {
  private readonly bomsGateway = inject(BomsGateway);
  private readonly standardBomsGateway = inject(StandardBomsGateway);
  private readonly authGateway = inject(AuthGateway);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  protected readonly displayedColumns = DISPLAYED_COLUMNS;

  protected readonly bomsResource = rxResource({
    stream: () => this.bomsGateway.list(),
    defaultValue: [] as AppBom[],
  });

  /**
   * The standard BOM picker inside the create/edit dialog needs every standard BOM's *current*
   * composition — see `bom-form-dialog.ts` — and this page's own "کد MI آنالیز استاندارد" column
   * needs each daily BOM's referenced MI code, so both share the one fetch rather than each dialog
   * opening fetching its own copy.
   */
  protected readonly standardBomsResource = rxResource({
    stream: () => this.standardBomsGateway.list(),
    defaultValue: [] as AppStandardBom[],
  });

  protected readonly loading = computed(
    () => this.bomsResource.isLoading() || this.standardBomsResource.isLoading(),
  );

  /** Typed separately from `bomsResource.value()` — the table's row context otherwise infers `any`. */
  protected readonly rows = computed<AppBom[]>(() => this.bomsResource.value());

  protected readonly standardBomMiCodeById = computed(
    () =>
      new Map(
        this.standardBomsResource
          .value()
          .map((standardBom) => [standardBom.id, standardBom.miCode]),
      ),
  );

  protected openCreateDialog(): void {
    this.dialog
      .open(BomFormDialog, {
        data: { mode: 'create', standardBoms: this.standardBomsResource.value() },
      })
      .afterClosed()
      .subscribe((registered) => {
        if (registered) {
          this.bomsResource.reload();
        }
      });
  }

  protected openEditDialog(bom: AppBom): void {
    this.dialog
      .open(BomFormDialog, {
        data: { mode: 'edit', bom, standardBoms: this.standardBomsResource.value() },
      })
      .afterClosed()
      .subscribe((edited) => {
        if (edited) {
          this.bomsResource.reload();
        }
      });
  }

  protected openDeleteDialog(bom: AppBom): void {
    this.dialog
      .open(ConfirmDeleteBomDialog, { data: { bom } })
      .afterClosed()
      .subscribe((deleted) => {
        if (deleted) {
          this.bomsResource.reload();
        }
      });
  }

  protected logout(): void {
    this.authGateway.logout();
    this.router.navigateByUrl('/login');
  }
}
