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

import { AppMaterial, MaterialsGateway } from '../../core/materials/materials-gateway';
import { ConfirmDeleteMaterialDialog } from './confirm-delete-material-dialog';
import { MaterialFormDialog } from './material-form-dialog';

const DISPLAYED_COLUMNS = ['name', 'actions'];

@Component({
  selector: 'app-materials-page',
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
        <h1>مدیریت مواد اولیه</h1>
        <div class="header-actions">
          @if (!forbidden()) {
            <button matButton="filled" type="button" (click)="openCreateDialog()">
              افزودن مواد اولیه
            </button>
          }
        </div>
      </div>

      @if (materialsResource.isLoading()) {
        <mat-progress-bar mode="indeterminate" aria-label="در حال بارگذاری فهرست مواد اولیه" />
      } @else if (forbidden()) {
        <p role="alert" class="form-error">شما دسترسی لازم برای مشاهده این بخش را ندارید.</p>
      } @else if (materialsResource.error()) {
        <div class="stack--tight">
          <p role="alert" class="form-error">فهرست مواد اولیه بارگذاری نشد.</p>
          <button matButton type="button" (click)="materialsResource.reload()">تلاش دوباره</button>
        </div>
      } @else if (rows().length === 0) {
        <p>هیچ مادهٔ اولیه‌ای ثبت نشده است.</p>
      } @else {
        <div class="table-scroll">
          <table mat-table [dataSource]="rows()">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>نام</th>
              <td mat-cell *matCellDef="let material">{{ material.name }}</td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef>عملیات</th>
              <td mat-cell *matCellDef="let material">
                <button
                  matButton
                  type="button"
                  [attr.aria-label]="'ویرایش ' + material.name"
                  (click)="openEditDialog(material)"
                >
                  ویرایش
                </button>
                <button
                  matButton
                  type="button"
                  [attr.aria-label]="'حذف ' + material.name"
                  (click)="openDeleteDialog(material)"
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
  styleUrl: './materials-page.scss',
})
export class MaterialsPage {
  private readonly materialsGateway = inject(MaterialsGateway);
  private readonly dialog = inject(MatDialog);

  protected readonly displayedColumns = DISPLAYED_COLUMNS;

  protected readonly materialsResource = rxResource({
    stream: () => this.materialsGateway.list(),
    defaultValue: [] as AppMaterial[],
  });

  /** Typed separately from `materialsResource.value()` — the table's row context otherwise infers `any`. */
  protected readonly rows = computed<AppMaterial[]>(() => this.materialsResource.value());

  /**
   * The API has no "who am I" endpoint, so the frontend cannot know the caller's role ahead of
   * time — a 403 from the one call this page makes is what tells it access was denied, rather than
   * a client-side role check with nothing server-side to back it.
   */
  protected readonly forbidden = computed(() => {
    const error = this.materialsResource.error();
    return error instanceof HttpErrorResponse && error.status === 403;
  });

  protected openCreateDialog(): void {
    this.dialog
      .open(MaterialFormDialog, { data: { mode: 'create' } })
      .afterClosed()
      .subscribe((registered) => {
        if (registered) {
          this.materialsResource.reload();
        }
      });
  }

  protected openEditDialog(material: AppMaterial): void {
    this.dialog
      .open(MaterialFormDialog, { data: { mode: 'edit', material } })
      .afterClosed()
      .subscribe((edited) => {
        if (edited) {
          this.materialsResource.reload();
        }
      });
  }

  protected openDeleteDialog(material: AppMaterial): void {
    this.dialog
      .open(ConfirmDeleteMaterialDialog, { data: { material } })
      .afterClosed()
      .subscribe((deleted) => {
        if (deleted) {
          this.materialsResource.reload();
        }
      });
  }
}
