import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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

import { matchesSearch } from '../../core/i18n/search-normalizer';
import { AppQcActivity, QcActivitiesGateway } from '../../core/qc/qc-activities-gateway';
import { DataSheet } from '../../ui/data-sheet/data-sheet';
import { EmptyState } from '../../ui/empty-state/empty-state';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { Icon } from '../../ui/icon/icon';
import { PageHeader } from '../../ui/page-header/page-header';
import { PersianNumberPipe } from '../../ui/persian-number/persian-number-pipe';
import { TableSearch } from '../../ui/table-search/table-search';
import { ConfirmDeleteQcActivityDialog } from './confirm-delete-qc-activity-dialog';
import { QcActivityFormDialog, QcActivityFormDialogData } from './qc-activity-form-dialog';

const DISPLAYED_COLUMNS = ['name', 'assignedEquipmentCount', 'actions'];

/**
 * `/qc-activities` — «فعالیت‌های QC» under «اطلاعات پایه» (issue #119): the QC catalog, defined once
 * and independent of equipment, which each equipment's QC folder assigns from. Management and the
 * System Admin define, rename and delete; the API refuses a rename or a delete of an activity in use
 * — assigned to an equipment, or ever recorded — and the dialog says where. The System Admin may
 * still correct the name of one in use (`CorrectionConfirmation`).
 */
@Component({
  selector: 'app-qc-activities-page',
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
        heading="فعالیت‌های QC"
        description="فعالیت‌های کنترل کیفیت حین تولید؛ هر فعالیت یک بار تعریف و به تجهیزات تخصیص داده می‌شود."
      >
        <ng-container ngProjectAs="[pageHeaderActions]">
          @if (!forbidden()) {
            <button matButton="filled" type="button" (click)="openCreateDialog()">
              <mat-icon appIcon="add" />
              تعریف فعالیت QC
            </button>
          }
        </ng-container>
      </app-page-header>

      <app-data-sheet
        heading="فهرست فعالیت‌های QC"
        [count]="
          activitiesResource.isLoading() || activitiesResource.error() ? null : rows().length
        "
        [loading]="activitiesResource.isLoading()"
        loadingLabel="در حال بارگذاری فعالیت‌های QC"
      >
        @if (all().length > 0) {
          <app-table-search sheetSearch label="جستجوی عنوان فعالیت" [(value)]="query" />
        }

        @if (activitiesResource.isLoading()) {
          <!-- The sheet's progress bar says it. -->
        } @else if (forbidden()) {
          <app-error-banner message="شما دسترسی لازم برای مشاهده این بخش را ندارید." />
        } @else if (activitiesResource.error()) {
          <app-error-banner
            message="فهرست فعالیت‌های QC بارگذاری نشد."
            retryLabel="تلاش دوباره"
            (retry)="activitiesResource.reload()"
          />
        } @else if (all().length === 0) {
          <app-empty-state message="هنوز هیچ فعالیت QC تعریف نشده است." />
        } @else if (rows().length === 0) {
          <app-empty-state
            message="فعالیتی با این عنوان یافت نشد."
            actionLabel="پاک کردن جستجو"
            (action)="query.set('')"
          />
        } @else {
          <table mat-table [dataSource]="rows()">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>عنوان فعالیت</th>
              <td mat-cell *matCellDef="let activity" class="activity-name">
                {{ activity.name }}
              </td>
            </ng-container>

            <ng-container matColumnDef="assignedEquipmentCount">
              <th mat-header-cell *matHeaderCellDef>
                <span class="cell-end">تجهیزات تخصیص‌یافته</span>
              </th>
              <td mat-cell *matCellDef="let activity">
                <span class="cell-end">{{ activity.assignedEquipmentCount | persianNumber }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef>
                <span class="visually-hidden">عملیات</span>
              </th>
              <td mat-cell *matCellDef="let activity">
                <div class="cell-actions">
                  <button
                    matButton
                    class="button--small"
                    type="button"
                    [attr.aria-label]="'ویرایش ' + activity.name"
                    (click)="openEditDialog(activity)"
                  >
                    <mat-icon appIcon="edit" />
                    ویرایش
                  </button>
                  <button
                    matButton
                    class="button--small button--danger"
                    type="button"
                    [attr.aria-label]="'حذف ' + activity.name"
                    (click)="openDeleteDialog(activity)"
                  >
                    <mat-icon appIcon="delete" />
                    حذف
                  </button>
                </div>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
          </table>
        }
      </app-data-sheet>
    </div>
  `,
  styleUrl: './qc-activities-page.scss',
})
export class QcActivitiesPage {
  private readonly gateway = inject(QcActivitiesGateway);
  private readonly dialog = inject(MatDialog);

  protected readonly displayedColumns = DISPLAYED_COLUMNS;

  protected readonly activitiesResource = rxResource({
    stream: () => this.gateway.list(),
    defaultValue: [] as AppQcActivity[],
  });

  protected readonly query = signal('');

  protected readonly all = computed<AppQcActivity[]>(() =>
    this.activitiesResource.hasValue() ? this.activitiesResource.value() : [],
  );

  protected readonly rows = computed<AppQcActivity[]>(() => {
    const query = this.query();
    return this.all().filter((activity) => matchesSearch(activity.name, query));
  });

  protected readonly forbidden = computed(() => {
    const error = this.activitiesResource.error();
    return error instanceof HttpErrorResponse && error.status === 403;
  });

  protected openCreateDialog(): void {
    this.reloadOnChange({ mode: 'create' });
  }

  protected openEditDialog(activity: AppQcActivity): void {
    this.reloadOnChange({ mode: 'edit', activity });
  }

  protected openDeleteDialog(activity: AppQcActivity): void {
    this.dialog
      .open(ConfirmDeleteQcActivityDialog, { data: { activity } })
      .afterClosed()
      .subscribe((deleted) => {
        if (deleted === true) {
          this.activitiesResource.reload();
        }
      });
  }

  private reloadOnChange(data: QcActivityFormDialogData): void {
    this.dialog
      .open(QcActivityFormDialog, { data })
      .afterClosed()
      .subscribe((changed) => {
        if (changed === true) {
          this.activitiesResource.reload();
        }
      });
  }
}
