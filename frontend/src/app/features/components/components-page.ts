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
import {
  AppComponent as AppComponentRecord,
  ComponentsGateway,
} from '../../core/components/components-gateway';
import { CopyId } from '../../ui/copy-id-button/copy-id';
import { DataSheet } from '../../ui/data-sheet/data-sheet';
import { EmptyState } from '../../ui/empty-state/empty-state';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { PageHeader } from '../../ui/page-header/page-header';
import { TableSearch } from '../../ui/table-search/table-search';
import { ConfirmDeleteComponentDialog } from './confirm-delete-component-dialog';
import { ComponentFormDialog } from './component-form-dialog';

const DISPLAYED_COLUMNS = ['name', 'actions'];

@Component({
  selector: 'app-components-page',
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
        heading="مدیریت اجزا"
        description="بخش‌های سازندهٔ محصول، مانند هادی، عایق و غلاف"
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
            افزودن جز
          </button>
        }
      </app-page-header>

      <app-data-sheet
        heading="فهرست اجزا"
        [count]="
          componentsResource.isLoading() || componentsResource.error() ? null : rows().length
        "
        [loading]="componentsResource.isLoading()"
        loadingLabel="در حال بارگذاری فهرست اجزا"
      >
        @if (all().length > 0) {
          <app-table-search sheetSearch label="جستجوی نام جز" [(value)]="query" />
        }

        @if (componentsResource.isLoading()) {
          <!-- The sheet's progress bar says it; nothing to draw until the answer arrives. -->
        } @else if (forbidden()) {
          <app-error-banner message="شما دسترسی لازم برای مشاهده این بخش را ندارید." />
        } @else if (componentsResource.error()) {
          <app-error-banner
            message="فهرست اجزا بارگذاری نشد."
            retryLabel="تلاش دوباره"
            (retry)="componentsResource.reload()"
          />
        } @else if (all().length === 0) {
          <app-empty-state message="هیچ جزی ثبت نشده است." />
        } @else if (rows().length === 0) {
          <app-empty-state
            message="جزی با این نام یافت نشد."
            description="املای نام را بررسی کنید."
            actionLabel="پاک کردن جستجو"
            (action)="query.set('')"
          />
        } @else {
          <table mat-table [dataSource]="rows()">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>نام</th>
              <td mat-cell *matCellDef="let component">{{ component.name }}</td>
            </ng-container>

            <!-- «ویرایش» is the row's most common action; copying the id and deleting are in the
                 overflow menu — one menu for the table, filled with the row it was opened from. -->
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef>
                <span class="visually-hidden">عملیات</span>
              </th>
              <td mat-cell *matCellDef="let component">
                <div class="cell-actions">
                  <button
                    matButton
                    class="button--small"
                    type="button"
                    [attr.aria-label]="'ویرایش ' + component.name"
                    (click)="openEditDialog(component)"
                  >
                    ویرایش
                  </button>
                  <button
                    matIconButton
                    class="icon-button--small"
                    type="button"
                    [attr.aria-label]="'عملیات بیشتر برای ' + component.name"
                    [matMenuTriggerFor]="rowMenu"
                    [matMenuTriggerData]="{ component }"
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
        <ng-template matMenuContent let-component="component">
          <button mat-menu-item type="button" (click)="copyId.copy(component.id)">
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
            (click)="openDeleteDialog(component)"
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
  styleUrl: './components-page.scss',
})
export class ComponentsPage {
  private readonly componentsGateway = inject(ComponentsGateway);
  private readonly dialog = inject(MatDialog);
  protected readonly copyId = inject(CopyId);

  protected readonly displayedColumns = DISPLAYED_COLUMNS;

  protected readonly componentsResource = rxResource({
    stream: () => this.componentsGateway.list(),
    defaultValue: [] as AppComponentRecord[],
  });

  /** What the search box has typed. */
  protected readonly query = signal('');

  /** Every component, or none while the list is loading or has failed — `value()` throws in an error
   * state, and the template reads this before it decides which of loading / error / empty / table
   * to draw. */
  protected readonly all = computed<AppComponentRecord[]>(() =>
    this.componentsResource.hasValue() ? this.componentsResource.value() : [],
  );

  /**
   * The rows the table shows: every component whose name matches the search, all of them
   * while it is empty. Filtered here rather than server-side — the API has no component search, and
   * the whole list is already loaded. Typed explicitly — the table's row context otherwise infers
   * `any`.
   */
  protected readonly rows = computed<AppComponentRecord[]>(() => {
    const query = this.query();
    return this.all().filter((component) => matchesSearch(component.name, query));
  });

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
