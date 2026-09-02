import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormField, submit, validate, form } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
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

import { formatJalaliDateTime, parseJalaliDateTime } from '../../core/date/jalali-datetime';
import {
  AppAuditLogEntry,
  AppAuditLogFilters,
  AppAuditLogPage,
  AuditLogGateway,
} from '../../core/audit-log/audit-log-gateway';
import { ACTION_LABELS } from './action-labels';
import { AuditLogChangesDialog, AuditLogChangesDialogData } from './audit-log-changes-dialog';
import { RECORD_TYPE_LABELS } from './record-type-labels';

const DISPLAYED_COLUMNS = [
  'actorName',
  'occurredAt',
  'recordType',
  'recordId',
  'action',
  'actions',
];

const DEFAULT_PAGE_SIZE = 20;

interface FilterFormModel {
  readonly actorName: string;
  readonly recordId: string;
  readonly from: string;
  readonly to: string;
}

const BLANK_FILTER_FORM: FilterFormModel = { actorName: '', recordId: '', from: '', to: '' };
const NO_FILTERS: AppAuditLogFilters = {};

const JALALI_FORMAT_ERROR = {
  kind: 'invalidJalaliDateTime',
  message: 'قالب تاریخ و زمان معتبر نیست. نمونه: 1403/04/01 08:30',
};

/**
 * "گزارش رویدادهای سیستم" — the System Admin's own read side of every mutating event across every
 * module (user/product/component/material/standard-BOM/daily-BOM registration, edits, deletions),
 * newest first. `POST /api/audit-log` 401s or 403s for anyone else — `forbidden` below is what turns
 * that into an access-denied state, the same pattern `features/users` and `features/materials`
 * already use for their own System-Admin-only endpoints; there is no client-side role guard on the
 * route itself; the backend's status code is what actually decides.
 *
 * Only an `Edited` row offers a drill-in — `AuditLogGateway.changes` always returns `[]` for a
 * `Registered` or `Deleted` entry, so a button that could only ever open on an empty state is not
 * offered for either.
 */
@Component({
  selector: 'app-audit-log-page',
  imports: [
    FormField,
    MatButton,
    MatCell,
    MatCellDef,
    MatColumnDef,
    MatError,
    MatFormField,
    MatHeaderCell,
    MatHeaderCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatInput,
    MatLabel,
    MatPaginator,
    MatProgressBar,
    MatRow,
    MatRowDef,
    MatTable,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack">
      <div class="header">
        <h1>گزارش رویدادهای سیستم</h1>
      </div>

      @if (!forbidden()) {
        <form novalidate class="filters" (submit)="onApplyFilters(); $event.preventDefault()">
          <mat-form-field appearance="outline">
            <mat-label>نام کاربر</mat-label>
            <input matInput [formField]="filterForm.actorName" autocomplete="off" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>شناسه رکورد</mat-label>
            <input matInput [formField]="filterForm.recordId" autocomplete="off" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>از تاریخ و زمان</mat-label>
            <input matInput [formField]="filterForm.from" autocomplete="off" />
            @if (filterForm.from().touched() && filterForm.from().errors().length) {
              <mat-error>{{ filterForm.from().errors()[0].message }}</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>تا تاریخ و زمان</mat-label>
            <input matInput [formField]="filterForm.to" autocomplete="off" placeholder="اکنون" />
            @if (filterForm.to().touched() && filterForm.to().errors().length) {
              <mat-error>{{ filterForm.to().errors()[0].message }}</mat-error>
            }
          </mat-form-field>

          <div class="filter-actions">
            <button matButton="outlined" type="submit">اعمال فیلترها</button>
            <button matButton type="button" (click)="onClearFilters()">پاک کردن فیلترها</button>
          </div>
        </form>
      }

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" aria-label="در حال بارگذاری گزارش رویدادهای سیستم" />
      } @else if (forbidden()) {
        <p role="alert" class="form-error">شما دسترسی لازم برای مشاهده این بخش را ندارید.</p>
      } @else if (listResource.error()) {
        <div class="stack--tight">
          <p role="alert" class="form-error">گزارش رویدادهای سیستم بارگذاری نشد.</p>
          <button matButton type="button" (click)="listResource.reload()">تلاش دوباره</button>
        </div>
      } @else if (rows().length === 0) {
        <p>هیچ رویدادی یافت نشد.</p>
      } @else {
        <div class="table-scroll">
          <table mat-table [dataSource]="rows()">
            <ng-container matColumnDef="actorName">
              <th mat-header-cell *matHeaderCellDef>کاربر</th>
              <td mat-cell *matCellDef="let row">{{ row.actorName }}</td>
            </ng-container>

            <ng-container matColumnDef="occurredAt">
              <th mat-header-cell *matHeaderCellDef>تاریخ و زمان</th>
              <td mat-cell *matCellDef="let row">{{ formatOccurredAt(row.occurredAt) }}</td>
            </ng-container>

            <ng-container matColumnDef="recordType">
              <th mat-header-cell *matHeaderCellDef>نوع رکورد</th>
              <td mat-cell *matCellDef="let row">{{ recordTypeLabel(row) }}</td>
            </ng-container>

            <ng-container matColumnDef="recordId">
              <th mat-header-cell *matHeaderCellDef>شناسه رکورد</th>
              <td mat-cell *matCellDef="let row">{{ row.recordId }}</td>
            </ng-container>

            <ng-container matColumnDef="action">
              <th mat-header-cell *matHeaderCellDef>نوع رویداد</th>
              <td mat-cell *matCellDef="let row">{{ actionLabel(row) }}</td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef>عملیات</th>
              <td mat-cell *matCellDef="let row">
                @if (row.action === 'Edited') {
                  <button
                    matButton
                    type="button"
                    [attr.aria-label]="'جزئیات تغییرات ' + row.recordId"
                    (click)="openChangesDialog(row)"
                  >
                    جزئیات
                  </button>
                } @else {
                  —
                }
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
          </table>
        </div>

        <mat-paginator
          [length]="total()"
          [pageIndex]="pageIndex()"
          [pageSize]="pageSize()"
          [pageSizeOptions]="[10, 20, 50]"
          (page)="onPage($event)"
        />
      }
    </div>
  `,
  styleUrl: './audit-log-page.scss',
})
export class AuditLogPage {
  private readonly gateway = inject(AuditLogGateway);
  private readonly dialog = inject(MatDialog);

  protected readonly displayedColumns = DISPLAYED_COLUMNS;

  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  private readonly filters = signal<AppAuditLogFilters>(NO_FILTERS);

  protected readonly listResource = rxResource({
    params: () => ({
      page: this.pageIndex() + 1,
      pageSize: this.pageSize(),
      filters: this.filters(),
    }),
    stream: ({ params }) => this.gateway.list(params.page, params.pageSize, params.filters),
    defaultValue: { items: [], total: 0 } as AppAuditLogPage,
  });

  protected readonly loading = computed(() => this.listResource.isLoading());
  protected readonly rows = computed<AppAuditLogEntry[]>(() => this.listResource.value().items);
  protected readonly total = computed(() => this.listResource.value().total);

  protected readonly forbidden = computed(() => {
    const error = this.listResource.error();
    return error instanceof HttpErrorResponse && error.status === 403;
  });

  private readonly filterModel = signal<FilterFormModel>(BLANK_FILTER_FORM);

  protected readonly filterForm = form(this.filterModel, (path) => {
    validate(path.from, ({ value }) => {
      const text = value().trim();
      return text !== '' && parseJalaliDateTime(text) === undefined
        ? JALALI_FORMAT_ERROR
        : undefined;
    });
    validate(path.to, ({ value }) => {
      const text = value().trim();
      return text !== '' && parseJalaliDateTime(text) === undefined
        ? JALALI_FORMAT_ERROR
        : undefined;
    });
  });

  protected recordTypeLabel(entry: AppAuditLogEntry): string {
    return RECORD_TYPE_LABELS[entry.recordType];
  }

  protected actionLabel(entry: AppAuditLogEntry): string {
    return ACTION_LABELS[entry.action];
  }

  protected formatOccurredAt(iso: string): string {
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime()) ? '—' : formatJalaliDateTime(parsed);
  }

  protected onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  protected onApplyFilters(): Promise<boolean> {
    return submit(this.filterForm, async () => {
      const { actorName, recordId, from, to } = this.filterModel();
      const actorNameText = actorName.trim();
      const recordIdText = recordId.trim();
      const fromText = from.trim();
      const toText = to.trim();

      this.filters.set({
        actorName: actorNameText === '' ? undefined : actorNameText,
        recordId: recordIdText === '' ? undefined : recordIdText,
        from: fromText === '' ? undefined : parseJalaliDateTime(fromText)!.toISOString(),
        to: toText === '' ? undefined : parseJalaliDateTime(toText)!.toISOString(),
      });
      this.pageIndex.set(0);
      return undefined;
    });
  }

  protected onClearFilters(): void {
    this.filterModel.set(BLANK_FILTER_FORM);
    this.filters.set(NO_FILTERS);
    this.pageIndex.set(0);
  }

  protected openChangesDialog(entry: AppAuditLogEntry): void {
    const data: AuditLogChangesDialogData = {
      id: entry.id,
      actorName: entry.actorName,
      recordTypeLabel: this.recordTypeLabel(entry),
      occurredAt: entry.occurredAt,
    };
    this.dialog.open(AuditLogChangesDialog, { data });
  }
}
