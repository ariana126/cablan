import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  model,
  output,
  signal,
} from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSort, MatSortHeader, Sort } from '@angular/material/sort';
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

import { formatJalaliCalendarDate } from '../../core/date/calendar-date';
import { FileSaver } from '../../core/files/file-saver';
import { toLatinDigits } from '../../core/i18n/persian-numerals';
import { PM_STATUS_LABELS, PmOccurrenceStatus } from '../../core/i18n/pm-status-labels';
import { AppPmDashboardOccurrence } from '../../core/maintenance/pm-dashboard-gateway';
import { AppPmOccurrence } from '../../core/maintenance/pm-schedule-gateway';
import { ActiveFilters } from '../../ui/active-filters/active-filters';
import { ActiveFilterChip } from '../../ui/active-filters/active-filter-chips';
import { DataSheet } from '../../ui/data-sheet/data-sheet';
import { Icon } from '../../ui/icon/icon';
import { PmStatusBadge } from '../../ui/pm-status-badge/pm-status-badge';
import { TableSearch } from '../../ui/table-search/table-search';
import {
  PmOccurrenceDetailsDialog,
  PmOccurrenceDetailsDialogData,
} from '../pm-schedule/pm-occurrence-details-dialog';
import {
  RecordExecutionDialog,
  RecordExecutionDialogData,
} from '../pm-schedule/record-execution-dialog';
import {
  followUpCsv,
  followUpDelayLabel,
  followUpRows,
  focusLabel,
  PmFollowUpFocus,
  PmFollowUpSort,
  PmFollowUpSortColumn,
  sortFollowUpRows,
} from './pm-follow-up';

const DISPLAYED_COLUMNS = ['equipment', 'activity', 'dueDate', 'status', 'delay', 'actions'];

const STATUS_OPTIONS = (Object.keys(PM_STATUS_LABELS) as PmOccurrenceStatus[]).map((status) => ({
  value: status,
  label: PM_STATUS_LABELS[status],
}));

const PAGE_SIZES = [25, 50, 100];

interface StatusFilterModel {
  /** `''` is «همه». */
  readonly status: PmOccurrenceStatus | '';
}

/** The details dialog reads the PM overview's shape; a dashboard row has every fact it shows. */
const toDetails = (row: AppPmDashboardOccurrence): AppPmOccurrence => ({
  equipmentId: row.equipmentId,
  equipmentName: row.equipmentName,
  equipmentRetired: row.equipmentRetired,
  planItemId: row.planItemId,
  activityId: row.activityId,
  activityName: row.activityName,
  // The dashboard's answer carries no specialty, and neither dialog shows one.
  activitySpecialty: null,
  dueDate: row.dueDate,
  calendarDate: row.dueDate,
  status: row.status,
  performedAt: row.performedAt,
  performedById: null,
  performedBy: row.performedByName,
  daysLate: row.daysLate,
  notes: row.notes,
});

/**
 * «فعالیت های نیازمند پیگیری» — the dashboard's follow-up table: every occurrence the panels above
 * count, narrowed by what was clicked above (`focus`, shown as a removable chip), by «وضعیت» and by
 * «جستجو» — all in the browser, since the one dashboard request already holds every row. Sortable
 * by every column but the actions; paginated.
 *
 * Each row offers «جزئیات» (the PM overview's details dialog, from the row's own data) and, when the
 * API says it is `recordable`, «ثبت انجام» — the daily list's own dialog and gateway — after which
 * it emits `recorded` and the page re-reads the dashboard. «خروجی اکسل» saves the rows as filtered
 * and sorted, every page of them.
 */
@Component({
  selector: 'app-pm-follow-up-sheet',
  imports: [
    ActiveFilters,
    DataSheet,
    FormField,
    Icon,
    MatButton,
    MatCell,
    MatCellDef,
    MatColumnDef,
    MatFormField,
    MatHeaderCell,
    MatHeaderCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatIcon,
    MatLabel,
    MatOption,
    MatPaginator,
    MatRow,
    MatRowDef,
    MatSelect,
    MatSort,
    MatSortHeader,
    MatTable,
    PmStatusBadge,
    TableSearch,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-data-sheet heading="فعالیت های نیازمند پیگیری" [count]="rows().length">
      <app-table-search sheetSearch label="جستجو" [(value)]="search" />
      <mat-form-field sheetFilters appearance="outline" subscriptSizing="dynamic">
        <mat-label>وضعیت</mat-label>
        <mat-select [formField]="statusForm.status">
          <mat-option value="">همه</mat-option>
          @for (status of statusOptions; track status.value) {
            <mat-option [value]="status.value">{{ status.label }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <button
        sheetActions
        matButton="outlined"
        type="button"
        [disabled]="rows().length === 0"
        (click)="export()"
      >
        <mat-icon appIcon="spreadsheet" />خروجی اکسل
      </button>

      <app-active-filters
        sheetChips
        [chips]="chips()"
        (removed)="removeChip($event)"
        (clearedAll)="clearAll()"
      />

      <table
        mat-table
        matSort
        [dataSource]="pageRows()"
        (matSortChange)="onSort($event)"
        aria-label="فعالیت های نیازمند پیگیری"
      >
        <ng-container matColumnDef="equipment">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>تجهیز</th>
          <td mat-cell *matCellDef="let row">{{ row.equipmentName }}</td>
        </ng-container>

        <ng-container matColumnDef="activity">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>فعالیت</th>
          <td mat-cell *matCellDef="let row">{{ row.activityName }}</td>
        </ng-container>

        <ng-container matColumnDef="dueDate">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>
            <span class="cell-end">تاریخ سررسید</span>
          </th>
          <td mat-cell *matCellDef="let row">
            <span class="cell-end">{{ jalaliDate(row.dueDate) }}</span>
          </td>
        </ng-container>

        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>وضعیت</th>
          <td mat-cell *matCellDef="let row"><app-pm-status-badge [status]="row.status" /></td>
        </ng-container>

        <ng-container matColumnDef="delay">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>
            <span class="cell-end">مقدار تاخیر</span>
          </th>
          <td mat-cell *matCellDef="let row">
            <span class="cell-end">{{ delay(row) }}</span>
          </td>
        </ng-container>

        <ng-container matColumnDef="actions" stickyEnd>
          <th mat-header-cell *matHeaderCellDef>
            <span class="visually-hidden">عملیات</span>
          </th>
          <td mat-cell *matCellDef="let row">
            <div class="cell-actions">
              <button
                matButton
                class="button--small"
                type="button"
                [attr.aria-label]="
                  'جزئیات ' +
                  row.activityName +
                  ' ' +
                  row.equipmentName +
                  ' ' +
                  jalaliDate(row.dueDate)
                "
                (click)="openDetails(row)"
              >
                <mat-icon appIcon="details" />جزئیات
              </button>
              @if (row.recordable) {
                <button
                  matButton="outlined"
                  class="button--small"
                  type="button"
                  [attr.aria-label]="'ثبت انجام ' + row.activityName + ' ' + row.equipmentName"
                  (click)="openRecordDialog(row)"
                >
                  <mat-icon appIcon="check-circle" />ثبت انجام
                </button>
              }
            </div>
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
      </table>
      <!-- Under the table, not a matNoDataRow, which would read as one more row of data. -->
      @if (rows().length === 0) {
        <p class="no-data">موعدی با این فیلترها نیست.</p>
      }

      @if (rows().length > pageSizes[0]) {
        <mat-paginator
          sheetFooter
          [length]="rows().length"
          [pageIndex]="pageIndex()"
          [pageSize]="pageSize()"
          [pageSizeOptions]="pageSizes"
          (page)="onPage($event)"
        />
      }
    </app-data-sheet>
  `,
  styleUrl: './pm-follow-up-sheet.scss',
})
export class PmFollowUpSheet {
  private readonly dialog = inject(MatDialog);
  private readonly fileSaver = inject(FileSaver);

  readonly occurrences = input.required<readonly AppPmDashboardOccurrence[]>();
  /** The API's today, ISO — it names the exported file. */
  readonly today = input.required<string>();
  /** What a click elsewhere on the page narrowed the table to; the chip's × lifts it. */
  readonly focus = model<PmFollowUpFocus | null>(null);
  /** A recording went through: the dashboard's figures are stale. */
  readonly recorded = output<void>();

  protected readonly displayedColumns = DISPLAYED_COLUMNS;
  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly jalaliDate = formatJalaliCalendarDate;
  protected readonly delay = followUpDelayLabel;

  protected readonly search = signal('');
  private readonly statusModel = signal<StatusFilterModel>({ status: '' });
  protected readonly statusForm = form(this.statusModel);
  private readonly sort = signal<PmFollowUpSort>({ column: '', direction: '' });

  /** What the visitor chose — not the data: a re-read of the same dashboard leaves it alone. */
  private readonly view = computed(() => ({
    focus: this.focus(),
    status: this.statusModel().status,
    search: this.search(),
    sort: this.sort(),
  }));

  protected readonly rows = computed(() => {
    const { sort, ...filter } = this.view();
    return sortFollowUpRows(followUpRows(this.occurrences(), filter), sort);
  });

  protected readonly pageSize = signal(PAGE_SIZES[0]);
  /**
   * The page asked for: back to the first one when the visitor changes a filter, a card or the
   * sort, but kept when only the data is re-read (after «ثبت انجام», or «به‌روزرسانی»).
   */
  private readonly requestedPage = linkedSignal({ source: this.view, computation: () => 0 });

  /** That page, or the last one that still exists if a re-read brought fewer rows. */
  protected readonly pageIndex = computed(() => {
    const lastPage = Math.max(0, Math.ceil(this.rows().length / this.pageSize()) - 1);
    return Math.min(this.requestedPage(), lastPage);
  });

  protected readonly pageRows = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.rows().slice(start, start + this.pageSize());
  });

  protected readonly chips = computed<readonly ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = [];
    const focus = this.focus();
    if (focus !== null) {
      const value = focusLabel(focus);
      chips.push({
        id: 'focus',
        filterKey: 'focus',
        filterValue: undefined,
        column: 'نمایش',
        value,
        removeLabel: `حذف فیلتر نمایش: ${value}`,
      });
    }
    const status = this.statusModel().status;
    if (status !== '') {
      const value = PM_STATUS_LABELS[status];
      chips.push({
        id: 'status',
        filterKey: 'status',
        filterValue: status,
        column: 'وضعیت',
        value,
        removeLabel: `حذف فیلتر وضعیت: ${value}`,
      });
    }
    return chips;
  });

  protected removeChip(chip: ActiveFilterChip): void {
    if (chip.filterKey === 'focus') {
      this.focus.set(null);
    } else {
      this.statusModel.set({ status: '' });
    }
  }

  protected clearAll(): void {
    this.focus.set(null);
    this.statusModel.set({ status: '' });
    this.search.set('');
  }

  protected onSort(sort: Sort): void {
    this.sort.set({
      column: sort.direction === '' ? '' : (sort.active as PmFollowUpSortColumn),
      direction: sort.direction,
    });
  }

  protected onPage(event: PageEvent): void {
    this.pageSize.set(event.pageSize);
    this.requestedPage.set(event.pageIndex);
  }

  protected openDetails(row: AppPmDashboardOccurrence): void {
    this.dialog.open<PmOccurrenceDetailsDialog, PmOccurrenceDetailsDialogData>(
      PmOccurrenceDetailsDialog,
      { data: { occurrence: toDetails(row) } },
    );
  }

  protected openRecordDialog(row: AppPmDashboardOccurrence): void {
    this.dialog
      .open<RecordExecutionDialog, RecordExecutionDialogData, boolean>(RecordExecutionDialog, {
        data: {
          task: {
            equipmentId: row.equipmentId,
            equipmentName: row.equipmentName,
            planItemId: row.planItemId,
            activityId: row.activityId,
            activityName: row.activityName,
            activitySpecialty: null,
            dueDate: row.dueDate,
            // Only due and overdue work is recordable.
            status: row.status === 'overdue' ? 'overdue' : 'due',
            daysOverdue: row.daysOverdue,
          },
        },
      })
      .afterClosed()
      .subscribe((recorded) => {
        if (recorded === true) {
          this.recorded.emit();
        }
      });
  }

  protected export(): void {
    const day = toLatinDigits(formatJalaliCalendarDate(this.today())).replace(/\//g, '-');
    this.fileSaver.save(
      new Blob([followUpCsv(this.rows())], { type: 'text/csv;charset=utf-8' }),
      `pm-follow-up-${day}.csv`,
    );
  }
}
