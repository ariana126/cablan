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

import { matchesSearch } from '../../core/i18n/search-normalizer';
import { AppMaterial, MaterialsGateway } from '../../core/materials/materials-gateway';
import { CopyId } from '../../ui/copy-id-button/copy-id';
import { DataSheet } from '../../ui/data-sheet/data-sheet';
import { EmptyState } from '../../ui/empty-state/empty-state';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { PageHeader } from '../../ui/page-header/page-header';
import { TableSearch } from '../../ui/table-search/table-search';
import { ConfirmDeleteMaterialDialog } from './confirm-delete-material-dialog';
import { MaterialFormDialog } from './material-form-dialog';

const DISPLAYED_COLUMNS = ['code', 'name', 'actions'];

/** Whether a material's name or code contains the search text — see `normalizeForSearch`. */
function matchesMaterial(material: AppMaterial, query: string): boolean {
  return matchesSearch(material.name, query) || matchesSearch(material.code, query);
}

@Component({
  selector: 'app-materials-page',
  imports: [
    DataSheet,
    EmptyState,
    ErrorBanner,
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
    TableSearch,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack">
      <app-page-header
        heading="مدیریت مواد اولیه"
        description="موادی که در آنالیزها به هر جز نسبت داده می‌شوند"
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
            افزودن مواد اولیه
          </button>
        }
      </app-page-header>

      <app-data-sheet
        heading="فهرست مواد اولیه"
        [count]="materialsResource.isLoading() || materialsResource.error() ? null : rows().length"
        [loading]="materialsResource.isLoading()"
        loadingLabel="در حال بارگذاری فهرست مواد اولیه"
      >
        @if (all().length > 0) {
          <app-table-search sheetSearch label="جستجوی نام یا کد" [(value)]="query" />
        }

        @if (materialsResource.isLoading()) {
          <!-- The sheet's progress bar says it; nothing to draw until the answer arrives. -->
        } @else if (forbidden()) {
          <app-error-banner message="شما دسترسی لازم برای مشاهده این بخش را ندارید." />
        } @else if (materialsResource.error()) {
          <app-error-banner
            message="فهرست مواد اولیه بارگذاری نشد."
            retryLabel="تلاش دوباره"
            (retry)="materialsResource.reload()"
          />
        } @else if (all().length === 0) {
          <app-empty-state message="هیچ مادهٔ اولیه‌ای ثبت نشده است." />
        } @else if (rows().length === 0) {
          <app-empty-state
            message="ماده‌ای با این نام یا کد یافت نشد."
            description="املای نام را بررسی کنید یا بخشی از کد را جستجو کنید."
            actionLabel="پاک کردن جستجو"
            (action)="query.set('')"
          />
        } @else {
          <table mat-table [dataSource]="rows()">
            <ng-container matColumnDef="code">
              <th mat-header-cell *matHeaderCellDef>کد</th>
              <td mat-cell *matCellDef="let material">
                <bdi class="cell-id">{{ material.code }}</bdi>
              </td>
            </ng-container>

            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>نام</th>
              <td mat-cell *matCellDef="let material">{{ material.name }}</td>
            </ng-container>

            <!-- «ویرایش» is the row's most common action; copying the id and deleting are in the
                 overflow menu — one menu for the table, filled with the row it was opened from. -->
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef>
                <span class="visually-hidden">عملیات</span>
              </th>
              <td mat-cell *matCellDef="let material">
                <div class="cell-actions">
                  <button
                    matButton
                    class="button--small"
                    type="button"
                    [attr.aria-label]="'ویرایش ' + material.name"
                    (click)="openEditDialog(material)"
                  >
                    ویرایش
                  </button>
                  <button
                    matIconButton
                    class="icon-button--small"
                    type="button"
                    [attr.aria-label]="'عملیات بیشتر برای ' + material.name"
                    [matMenuTriggerFor]="rowMenu"
                    [matMenuTriggerData]="{ material }"
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
        <ng-template matMenuContent let-material="material">
          <button mat-menu-item type="button" (click)="copyId.copy(material.id)">
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
            (click)="openDeleteDialog(material)"
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
  styleUrl: './materials-page.scss',
})
export class MaterialsPage {
  private readonly materialsGateway = inject(MaterialsGateway);
  private readonly dialog = inject(MatDialog);
  protected readonly copyId = inject(CopyId);

  protected readonly displayedColumns = DISPLAYED_COLUMNS;

  protected readonly materialsResource = rxResource({
    stream: () => this.materialsGateway.list(),
    defaultValue: [] as AppMaterial[],
  });

  /** What the search box has typed. */
  protected readonly query = signal('');

  /** Every material, or none while the list is loading or has failed — `value()` throws in an error
   * state, and the template reads this before it decides which of loading / error / empty / table
   * to draw. */
  protected readonly all = computed<AppMaterial[]>(() =>
    this.materialsResource.hasValue() ? this.materialsResource.value() : [],
  );

  /**
   * The rows the table shows: every material whose name or code matches the search, all of them
   * while it is empty. Filtered here rather than server-side — the API has no material search, and
   * the whole list is already loaded. Typed explicitly — the table's row context otherwise infers
   * `any`.
   */
  protected readonly rows = computed<AppMaterial[]>(() => {
    const query = this.query();
    return this.all().filter((material) => matchesMaterial(material, query));
  });

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
