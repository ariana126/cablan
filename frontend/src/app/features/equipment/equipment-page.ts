import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
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

import { matchesSearch } from '../../core/i18n/search-normalizer';
import { AppEquipment, EquipmentGateway } from '../../core/maintenance/equipment-gateway';
import { CopyId } from '../../ui/copy-id-button/copy-id';
import { DataSheet } from '../../ui/data-sheet/data-sheet';
import { EmptyState } from '../../ui/empty-state/empty-state';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { PageHeader } from '../../ui/page-header/page-header';
import { StatusBadge } from '../../ui/status-badge/status-badge';
import { TableSearch } from '../../ui/table-search/table-search';
import { ConfirmRetireEquipmentDialog } from './confirm-retire-equipment-dialog';
import { EquipmentFormDialog } from './equipment-form-dialog';
import { Icon } from '../../ui/icon/icon';

const DISPLAYED_COLUMNS = ['name', 'state', 'actions'];

/**
 * `/equipment` — «تجهیزات / دستگاه» under «اطلاعات پایه». The equipment a PM plan is kept for:
 * registered and renamed by name, retired from the row's actions menu. Retired equipment stays in
 * the list, marked, because its maintenance history does; it offers no actions.
 */
@Component({
  selector: 'app-equipment-page',
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
    StatusBadge,
    TableSearch,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack">
      <app-page-header
        heading="مدیریت تجهیزات / دستگاه"
        description="تجهیزات و دستگاه‌هایی که برنامهٔ تعمیرات پیشگیرانه برایشان تعریف می‌شود"
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
              افزودن تجهیز
            </button>
          }
        </ng-container>
      </app-page-header>

      <app-data-sheet
        heading="فهرست تجهیزات"
        [count]="equipmentResource.isLoading() || equipmentResource.error() ? null : rows().length"
        [loading]="equipmentResource.isLoading()"
        loadingLabel="در حال بارگذاری فهرست تجهیزات"
      >
        @if (all().length > 0) {
          <app-table-search sheetSearch label="جستجوی نام تجهیز" [(value)]="query" />
        }

        @if (equipmentResource.isLoading()) {
          <!-- The sheet's progress bar says it. -->
        } @else if (forbidden()) {
          <app-error-banner message="شما دسترسی لازم برای مشاهده این بخش را ندارید." />
        } @else if (equipmentResource.error()) {
          <app-error-banner
            message="فهرست تجهیزات بارگذاری نشد."
            retryLabel="تلاش دوباره"
            (retry)="equipmentResource.reload()"
          />
        } @else if (all().length === 0) {
          <app-empty-state message="هیچ تجهیزی ثبت نشده است." />
        } @else if (rows().length === 0) {
          <app-empty-state
            message="تجهیزی با این نام یافت نشد."
            actionLabel="پاک کردن جستجو"
            (action)="query.set('')"
          />
        } @else {
          <table mat-table [dataSource]="rows()">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>نام</th>
              <td mat-cell *matCellDef="let equipment">{{ equipment.name }}</td>
            </ng-container>

            <ng-container matColumnDef="state">
              <th mat-header-cell *matHeaderCellDef>وضعیت</th>
              <td mat-cell *matCellDef="let equipment">
                @if (equipment.retired) {
                  <app-status-badge kind="neutral" label="کنار گذاشته شده" />
                } @else {
                  فعال
                }
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef>
                <span class="visually-hidden">عملیات</span>
              </th>
              <td mat-cell *matCellDef="let equipment">
                @if (!equipment.retired) {
                  <div class="cell-actions">
                    <button
                      matButton
                      class="button--small"
                      type="button"
                      [attr.aria-label]="'ویرایش ' + equipment.name"
                      (click)="openEditDialog(equipment)"
                    >
                      <mat-icon appIcon="edit" />
                      ویرایش
                    </button>
                    <button
                      matIconButton
                      class="icon-button--small"
                      type="button"
                      [attr.aria-label]="'عملیات بیشتر برای ' + equipment.name"
                      [matMenuTriggerFor]="rowMenu"
                      [matMenuTriggerData]="{ equipment }"
                      (click)="rememberMenuTrigger($event)"
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
                }
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
          </table>
        }
      </app-data-sheet>

      <mat-menu #rowMenu="matMenu">
        <ng-template matMenuContent let-equipment="equipment">
          <button mat-menu-item type="button" (click)="copyId.copy(equipment.id)">
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
            (click)="openRetireDialog(equipment)"
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
                <circle cx="12" cy="12" r="9" />
                <path d="M5.6 5.6l12.8 12.8" />
              </svg>
            </mat-icon>
            <span>کنار گذاشتن</span>
          </button>
        </ng-template>
      </mat-menu>
    </div>
  `,
  styleUrl: './equipment-page.scss',
})
export class EquipmentPage {
  private readonly gateway = inject(EquipmentGateway);
  private readonly dialog = inject(MatDialog);
  protected readonly copyId = inject(CopyId);

  protected readonly displayedColumns = DISPLAYED_COLUMNS;

  protected readonly equipmentResource = rxResource({
    stream: () => this.gateway.list(),
    defaultValue: [] as AppEquipment[],
  });

  protected readonly query = signal('');

  protected readonly all = computed<AppEquipment[]>(() =>
    this.equipmentResource.hasValue() ? this.equipmentResource.value() : [],
  );

  protected readonly rows = computed<AppEquipment[]>(() => {
    const query = this.query();
    return this.all().filter((equipment) => matchesSearch(equipment.name, query));
  });

  protected readonly forbidden = computed(() => {
    const error = this.equipmentResource.error();
    return error instanceof HttpErrorResponse && error.status === 403;
  });

  /**
   * The row's «عملیات بیشتر» button, kept from its click. A dialog opened from one of the menu's
   * items would otherwise hand focus back to that item — gone with the menu — and so to <body>.
   */
  private menuTrigger: HTMLElement | undefined;

  protected rememberMenuTrigger(event: Event): void {
    this.menuTrigger = event.currentTarget as HTMLElement;
  }

  protected openCreateDialog(): void {
    this.reloadWhenTrue(this.dialog.open(EquipmentFormDialog, { data: { mode: 'create' } }));
  }

  protected openEditDialog(equipment: AppEquipment): void {
    this.reloadWhenTrue(
      this.dialog.open(EquipmentFormDialog, { data: { mode: 'edit', equipment } }),
    );
  }

  protected openRetireDialog(equipment: AppEquipment): void {
    this.reloadWhenTrue(
      this.dialog.open(ConfirmRetireEquipmentDialog, {
        data: { equipment },
        restoreFocus: this.menuTrigger,
      }),
    );
  }

  private reloadWhenTrue(ref: MatDialogRef<unknown, boolean>): void {
    ref.afterClosed().subscribe((changed) => {
      if (changed === true) {
        this.equipmentResource.reload();
      }
    });
  }
}
