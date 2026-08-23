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

import { Role } from '../../api/model';
import { AppUser, UsersGateway } from '../../core/users/users-gateway';
import { ConfirmDeleteUserDialog } from './confirm-delete-user-dialog';
import { ROLE_LABELS } from './role-labels';
import { UserFormDialog } from './user-form-dialog';

const DISPLAYED_COLUMNS = ['name', 'username', 'role', 'actions'];

@Component({
  selector: 'app-users-page',
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
        <h1>مدیریت کاربران</h1>
        @if (!forbidden()) {
          <button matButton="filled" type="button" (click)="openCreateDialog()">
            افزودن کاربر جدید
          </button>
        }
      </div>

      @if (usersResource.isLoading()) {
        <mat-progress-bar mode="indeterminate" aria-label="در حال بارگذاری فهرست کاربران" />
      } @else if (forbidden()) {
        <p role="alert" class="form-error">شما دسترسی لازم برای مشاهده این بخش را ندارید.</p>
      } @else if (usersResource.error()) {
        <div class="stack--tight">
          <p role="alert" class="form-error">فهرست کاربران بارگذاری نشد.</p>
          <button matButton type="button" (click)="usersResource.reload()">تلاش دوباره</button>
        </div>
      } @else if (rows().length === 0) {
        <p>هیچ کاربری ثبت نشده است.</p>
      } @else {
        <div class="table-scroll">
          <table mat-table [dataSource]="rows()">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>نام</th>
              <td mat-cell *matCellDef="let user">{{ user.name }}</td>
            </ng-container>

            <ng-container matColumnDef="username">
              <th mat-header-cell *matHeaderCellDef>نام کاربری</th>
              <td mat-cell *matCellDef="let user">{{ user.username }}</td>
            </ng-container>

            <ng-container matColumnDef="role">
              <th mat-header-cell *matHeaderCellDef>نقش</th>
              <td mat-cell *matCellDef="let user">{{ roleLabel(user) }}</td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef>عملیات</th>
              <td mat-cell *matCellDef="let user">
                <button
                  matButton
                  type="button"
                  [attr.aria-label]="'ویرایش ' + user.name"
                  (click)="openEditDialog(user)"
                >
                  ویرایش
                </button>
                <button
                  matButton
                  type="button"
                  [attr.aria-label]="'حذف ' + user.name"
                  (click)="openDeleteDialog(user)"
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
  styleUrl: './users-page.scss',
})
export class UsersPage {
  private readonly usersGateway = inject(UsersGateway);
  private readonly dialog = inject(MatDialog);

  private readonly roleLabels: Readonly<Record<Role, string>> = ROLE_LABELS;
  protected readonly displayedColumns = DISPLAYED_COLUMNS;

  protected readonly usersResource = rxResource({
    stream: () => this.usersGateway.list(),
    defaultValue: [] as AppUser[],
  });

  /** Typed separately from `usersResource.value()` — the table's row context otherwise infers `any`. */
  protected readonly rows = computed<AppUser[]>(() => this.usersResource.value());

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
