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
import { Role } from '../../api/model';
import { ROLE_LABELS } from '../../core/i18n/role-labels';
import { AppUser, UsersGateway } from '../../core/users/users-gateway';
import { CopyId } from '../../ui/copy-id-button/copy-id';
import { DataSheet } from '../../ui/data-sheet/data-sheet';
import { EmptyState } from '../../ui/empty-state/empty-state';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { PageHeader } from '../../ui/page-header/page-header';
import { TableSearch } from '../../ui/table-search/table-search';
import { TypeTag } from '../../ui/type-tag/type-tag';
import { ConfirmDeleteUserDialog } from './confirm-delete-user-dialog';
import { UserFormDialog } from './user-form-dialog';

const DISPLAYED_COLUMNS = ['name', 'username', 'role', 'actions'];

@Component({
  selector: 'app-users-page',
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
    TypeTag,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack">
      <app-page-header
        heading="مدیریت کاربران"
        description="حساب‌های دسترسی به سامانه و نقش هر کاربر"
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
            افزودن کاربر جدید
          </button>
        }
      </app-page-header>

      <app-data-sheet
        heading="فهرست کاربران"
        [count]="usersResource.isLoading() || usersResource.error() ? null : rows().length"
        [loading]="usersResource.isLoading()"
        loadingLabel="در حال بارگذاری فهرست کاربران"
      >
        @if (all().length > 0) {
          <app-table-search sheetSearch label="جستجوی نام یا نام کاربری" [(value)]="query" />
        }

        @if (usersResource.isLoading()) {
          <!-- The sheet's progress bar says it; nothing to draw until the answer arrives. -->
        } @else if (forbidden()) {
          <app-error-banner message="شما دسترسی لازم برای مشاهده این بخش را ندارید." />
        } @else if (usersResource.error()) {
          <app-error-banner
            message="فهرست کاربران بارگذاری نشد."
            retryLabel="تلاش دوباره"
            (retry)="usersResource.reload()"
          />
        } @else if (all().length === 0) {
          <app-empty-state message="هیچ کاربری ثبت نشده است." />
        } @else if (rows().length === 0) {
          <app-empty-state
            message="کاربری با این نام یافت نشد."
            description="املای نام یا نام کاربری را بررسی کنید."
            actionLabel="پاک کردن جستجو"
            (action)="query.set('')"
          />
        } @else {
          <table mat-table [dataSource]="rows()">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>نام</th>
              <td mat-cell *matCellDef="let user">{{ user.name }}</td>
            </ng-container>

            <ng-container matColumnDef="username">
              <th mat-header-cell *matHeaderCellDef>نام کاربری</th>
              <td mat-cell *matCellDef="let user">
                <bdi class="cell-id">{{ user.username }}</bdi>
              </td>
            </ng-container>

            <ng-container matColumnDef="role">
              <th mat-header-cell *matHeaderCellDef>نقش</th>
              <td mat-cell *matCellDef="let user"><app-type-tag [label]="roleLabel(user)" /></td>
            </ng-container>

            <!-- «ویرایش» is the row's most common action; copying the id and deleting are in the
                 overflow menu — one menu for the table, filled with the row it was opened from. -->
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef>
                <span class="visually-hidden">عملیات</span>
              </th>
              <td mat-cell *matCellDef="let user">
                <div class="cell-actions">
                  <button
                    matButton
                    class="button--small"
                    type="button"
                    [attr.aria-label]="'ویرایش ' + user.name"
                    (click)="openEditDialog(user)"
                  >
                    ویرایش
                  </button>
                  <button
                    matIconButton
                    class="icon-button--small"
                    type="button"
                    [attr.aria-label]="'عملیات بیشتر برای ' + user.name"
                    [matMenuTriggerFor]="rowMenu"
                    [matMenuTriggerData]="{ user }"
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
        <ng-template matMenuContent let-user="user">
          <button mat-menu-item type="button" (click)="copyId.copy(user.id)">
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
            (click)="openDeleteDialog(user)"
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
  styleUrl: './users-page.scss',
})
export class UsersPage {
  private readonly usersGateway = inject(UsersGateway);
  private readonly dialog = inject(MatDialog);
  protected readonly copyId = inject(CopyId);

  private readonly roleLabels: Readonly<Record<Role, string>> = ROLE_LABELS;
  protected readonly displayedColumns = DISPLAYED_COLUMNS;

  protected readonly usersResource = rxResource({
    stream: () => this.usersGateway.list(),
    defaultValue: [] as AppUser[],
  });

  /** What the search box has typed. */
  protected readonly query = signal('');

  /** Every user, or none while the list is loading or has failed — `value()` throws in an error
   * state, and the template reads this before it decides which of loading / error / empty / table
   * to draw. */
  protected readonly all = computed<AppUser[]>(() =>
    this.usersResource.hasValue() ? this.usersResource.value() : [],
  );

  /**
   * The rows the table shows: every user whose name or username matches the search, all of them
   * while it is empty. Filtered here rather than server-side — the API has no user search, and
   * the whole list is already loaded. Typed explicitly — the table's row context otherwise infers
   * `any`.
   */
  protected readonly rows = computed<AppUser[]>(() => {
    const query = this.query();
    return this.all().filter(
      (user) => matchesSearch(user.name, query) || matchesSearch(user.username, query),
    );
  });

  /**
   * The API has no "who am I" endpoint, so the frontend cannot know the caller's role ahead of
   * time — a 403 from the one call this page makes is what tells it access was denied, rather than
   * a client-side role check with nothing server-side to back it.
   */
  protected readonly forbidden = computed(() => {
    const error = this.usersResource.error();
    return error instanceof HttpErrorResponse && error.status === 403;
  });

  protected roleLabel(user: AppUser): string {
    return this.roleLabels[user.role];
  }

  protected openCreateDialog(): void {
    this.dialog
      .open(UserFormDialog, { data: { mode: 'create' } })
      .afterClosed()
      .subscribe((registered) => {
        if (registered) {
          this.usersResource.reload();
        }
      });
  }

  protected openEditDialog(user: AppUser): void {
    this.dialog
      .open(UserFormDialog, { data: { mode: 'edit', user } })
      .afterClosed()
      .subscribe((edited) => {
        if (edited) {
          this.usersResource.reload();
        }
      });
  }

  protected openDeleteDialog(user: AppUser): void {
    this.dialog
      .open(ConfirmDeleteUserDialog, { data: { user } })
      .afterClosed()
      .subscribe((deleted) => {
        if (deleted) {
          this.usersResource.reload();
        }
      });
  }
}
