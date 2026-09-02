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

import {
  AppComponent as AppComponentRecord,
  ComponentsGateway,
} from '../../core/components/components-gateway';
import { CopyIdButton } from '../../ui/copy-id-button/copy-id-button';
import { ConfirmDeleteComponentDialog } from './confirm-delete-component-dialog';
import { ComponentFormDialog } from './component-form-dialog';

const DISPLAYED_COLUMNS = ['name', 'actions'];

@Component({
  selector: 'app-components-page',
  imports: [
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
        <h1>مدیریت اجزا</h1>
        <div class="header-actions">
          @if (!forbidden()) {
            <button matButton="filled" type="button" (click)="openCreateDialog()">افزودن جز</button>
          }
        </div>
      </div>

      @if (componentsResource.isLoading()) {
        <mat-progress-bar mode="indeterminate" aria-label="در حال بارگذاری فهرست اجزا" />
      } @else if (forbidden()) {
        <p role="alert" class="form-error">شما دسترسی لازم برای مشاهده این بخش را ندارید.</p>
      } @else if (componentsResource.error()) {
        <div class="stack--tight">
          <p role="alert" class="form-error">فهرست اجزا بارگذاری نشد.</p>
          <button matButton type="button" (click)="componentsResource.reload()">تلاش دوباره</button>
        </div>
      } @else if (rows().length === 0) {
        <p>هیچ جزی ثبت نشده است.</p>
      } @else {
        <div class="table-scroll">
          <table mat-table [dataSource]="rows()">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>نام</th>
              <td mat-cell *matCellDef="let component">{{ component.name }}</td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef>عملیات</th>
              <td mat-cell *matCellDef="let component">
                <button
                  matButton
                  type="button"
                  [attr.aria-label]="'ویرایش ' + component.name"
                  (click)="openEditDialog(component)"
                >
                  ویرایش
                </button>
                <button
                  matButton
                  type="button"
                  [attr.aria-label]="'حذف ' + component.name"
                  (click)="openDeleteDialog(component)"
                >
                  حذف
                </button>
                <app-copy-id-button [entityId]="component.id" [entityName]="component.name" />
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
          </table>
        </div>
      }
    </div>
  `,
  styleUrl: './components-page.scss',
})
export class ComponentsPage {
  private readonly componentsGateway = inject(ComponentsGateway);
  private readonly dialog = inject(MatDialog);

  protected readonly displayedColumns = DISPLAYED_COLUMNS;

  protected readonly componentsResource = rxResource({
    stream: () => this.componentsGateway.list(),
    defaultValue: [] as AppComponentRecord[],
  });

  /** Typed separately from `componentsResource.value()` — the table's row context otherwise infers `any`. */
  protected readonly rows = computed<AppComponentRecord[]>(() => this.componentsResource.value());

  /**
   * The API has no "who am I" endpoint, so the frontend cannot know the caller's role ahead of
   * time — a 403 from the one call this page makes is what tells it access was denied, rather than
   * a client-side role check with nothing server-side to back it.
   */
  protected readonly forbidden = computed(() => {
    const error = this.componentsResource.error();
    return error instanceof HttpErrorResponse && error.status === 403;
  });

  protected openCreateDialog(): void {
    this.dialog
      .open(ComponentFormDialog, { data: { mode: 'create' } })
      .afterClosed()
      .subscribe((registered) => {
        if (registered) {
          this.componentsResource.reload();
        }
      });
  }

  protected openEditDialog(component: AppComponentRecord): void {
    this.dialog
      .open(ComponentFormDialog, { data: { mode: 'edit', component } })
      .afterClosed()
      .subscribe((edited) => {
        if (edited) {
          this.componentsResource.reload();
        }
      });
  }

  protected openDeleteDialog(component: AppComponentRecord): void {
    this.dialog
      .open(ConfirmDeleteComponentDialog, { data: { component } })
      .afterClosed()
      .subscribe((deleted) => {
        if (deleted) {
          this.componentsResource.reload();
        }
      });
  }
}
