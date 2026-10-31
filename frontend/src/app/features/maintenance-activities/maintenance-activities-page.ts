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
import {
  AppMaintenanceActivity,
  MaintenanceActivitiesGateway,
} from '../../core/maintenance/maintenance-activities-gateway';
import { DataSheet } from '../../ui/data-sheet/data-sheet';
import { EmptyState } from '../../ui/empty-state/empty-state';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { PageHeader } from '../../ui/page-header/page-header';
import { TableSearch } from '../../ui/table-search/table-search';
import {
  MaintenanceActivityFormDialog,
  MaintenanceActivityFormDialogData,
} from './maintenance-activity-form-dialog';
import { Icon } from '../../ui/icon/icon';

const DISPLAYED_COLUMNS = ['name', 'actions'];

/**
 * `/maintenance-activities` — «فعالیت های PM» under «اطلاعات پایه». The reusable
 * catalog every PM plan picks its activities from: added and renamed, never deleted (a plan or the
 * history may still name one).
 */
@Component({
  selector: 'app-maintenance-activities-page',
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
    TableSearch,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack">
      <app-page-header
        heading="مدیریت فعالیت های PM"
        description="فعالیت‌هایی که در برنامهٔ PM هر تجهیز به کار می‌روند"
      >
        <ng-container ngProjectAs="[pageHeaderActions]">
          @if (!forbidden()) {
            <button matButton="filled" type="button" (click)="openCreateDialog()">
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
              افزودن فعالیت
            </button>
          }
        </ng-container>
      </app-page-header>

      <app-data-sheet
        heading="فهرست فعالیت‌ها"
        [count]="
          activitiesResource.isLoading() || activitiesResource.error() ? null : rows().length
        "
        [loading]="activitiesResource.isLoading()"
        loadingLabel="در حال بارگذاری فهرست فعالیت‌ها"
      >
        @if (all().length > 0) {
          <app-table-search sheetSearch label="جستجوی نام فعالیت" [(value)]="query" />
        }

        @if (activitiesResource.isLoading()) {
          <!-- The sheet's progress bar says it. -->
        } @else if (forbidden()) {
          <app-error-banner message="شما دسترسی لازم برای مشاهده این بخش را ندارید." />
        } @else if (activitiesResource.error()) {
          <app-error-banner
            message="فهرست فعالیت‌ها بارگذاری نشد."
            retryLabel="تلاش دوباره"
            (retry)="activitiesResource.reload()"
          />
        } @else if (all().length === 0) {
          <app-empty-state message="هیچ فعالیتی ثبت نشده است." />
        } @else if (rows().length === 0) {
          <app-empty-state
            message="فعالیتی با این نام یافت نشد."
            actionLabel="پاک کردن جستجو"
            (action)="query.set('')"
          />
        } @else {
          <table mat-table [dataSource]="rows()">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>نام</th>
              <td mat-cell *matCellDef="let activity">{{ activity.name }}</td>
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
  styleUrl: './maintenance-activities-page.scss',
})
export class MaintenanceActivitiesPage {
  private readonly gateway = inject(MaintenanceActivitiesGateway);
  private readonly dialog = inject(MatDialog);

  protected readonly displayedColumns = DISPLAYED_COLUMNS;

  protected readonly activitiesResource = rxResource({
    stream: () => this.gateway.list(),
    defaultValue: [] as AppMaintenanceActivity[],
  });

  protected readonly query = signal('');

  protected readonly all = computed<AppMaintenanceActivity[]>(() =>
    this.activitiesResource.hasValue() ? this.activitiesResource.value() : [],
  );

  protected readonly rows = computed<AppMaintenanceActivity[]>(() => {
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

  protected openEditDialog(activity: AppMaintenanceActivity): void {
    this.reloadOnChange({ mode: 'edit', activity });
  }

  private reloadOnChange(data: MaintenanceActivityFormDialogData): void {
    this.dialog
      .open(MaintenanceActivityFormDialog, { data })
      .afterClosed()
      .subscribe((changed) => {
        if (changed === true) {
          this.activitiesResource.reload();
        }
      });
  }
}
