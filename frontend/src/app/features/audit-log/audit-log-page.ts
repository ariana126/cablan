import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { form, submit } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
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
  DateRangeFormModel,
  EMPTY_DATE_RANGE,
  appliedDateRange,
  dateRangeSchema,
  toIsoDateRange,
} from '../../core/date/date-range-form';
import { formatJalaliDateTime } from '../../core/date/jalali-datetime';
import {
  ActiveFilterChip,
  multiValueFilterChips,
  withoutFilterValue,
} from '../../ui/active-filters/active-filter-chips';
import { ActiveFilters } from '../../ui/active-filters/active-filters';
import { CopyIdButton } from '../../ui/copy-id-button/copy-id-button';
import { DataSheet } from '../../ui/data-sheet/data-sheet';
import { DateRange, DateRangePresets } from '../../ui/date-range-presets/date-range-presets';
import { EmptyState } from '../../ui/empty-state/empty-state';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { FilterButton } from '../../ui/filter-button/filter-button';
import { JalaliDatetimeField } from '../../ui/jalali-datetime-field/jalali-datetime-field';
import { PageHeader } from '../../ui/page-header/page-header';
import { StatusBadge } from '../../ui/status-badge/status-badge';
import { TableSearch } from '../../ui/table-search/table-search';
import { TypeTag } from '../../ui/type-tag/type-tag';
import {
  AppAuditLogEntry,
  AppAuditAction,
  AppAuditLogFilterOptions,
  AppAuditLogFilters,
  AppAuditLogPage,
  AppRecordType,
  AuditLogGateway,
} from '../../core/audit-log/audit-log-gateway';
import { ACTION_LABELS } from './action-labels';
import { AuditLogChangesDialog, AuditLogChangesDialogData } from './audit-log-changes-dialog';
import {
  AuditLogFilterDialog,
  AuditLogFilterDialogData,
  AuditLogFilterDialogResult,
} from './audit-log-filter-dialog';
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

/** How long the record-id search waits after the last keystroke before asking the server. */
const SEARCH_DEBOUNCE_MS = 300;

type DateRangeFilters = Pick<AppAuditLogFilters, 'from' | 'to'>;

const NO_LIST_FILTERS: AppAuditLogFilters = {};
const NO_DATE_RANGE: DateRangeFilters = {};

/** The three list-valued filters, each edited through its own Excel-style dialog. */
type ListFilterKey = 'actors' | 'recordTypes' | 'actions';

interface ListFilterField {
  readonly key: ListFilterKey;
  readonly label: string;
}

const LIST_FILTER_FIELDS: readonly ListFilterField[] = [
  { key: 'actors', label: 'کاربر' },
  { key: 'recordTypes', label: 'نوع رکورد' },
  { key: 'actions', label: 'نوع رویداد' },
];

const ACTION_KINDS: Readonly<Record<AppAuditAction, 'create' | 'update' | 'delete'>> = {
  Registered: 'create',
  Edited: 'update',
  Deleted: 'delete',
  // An approval changes a daily BOM's state rather than creating or removing anything.
  Approved: 'update',
  ApprovalRevoked: 'update',
};

/**
 * "رویداد های سیستم" — the System Admin's own read side of every mutating event across every
 * module (user/product/component/material/standard-BOM/daily-BOM registration, edits, deletions),
 * newest first. `POST /api/audit-log` 401s or 403s for anyone else — `forbidden` below is what turns
 * that into an access-denied state, the same pattern `features/users` and `features/materials`
 * already use for their own System-Admin-only endpoints; there is no client-side role guard on the
 * route itself; the backend's status code is what actually decides.
 *
 * Every row offers a drill-in: an `Edited` entry's changes are its before → after, and a
 * `Registered` or `Deleted` entry's are what was registered or removed.
 */
@Component({
  selector: 'app-audit-log-page',
  imports: [
    ActiveFilters,
    CopyIdButton,
    DataSheet,
    DateRangePresets,
    EmptyState,
    ErrorBanner,
    FilterButton,
    JalaliDatetimeField,
    MatButton,
    MatCell,
    MatCellDef,
    MatColumnDef,
    MatHeaderCell,
    MatHeaderCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatPaginator,
    MatRow,
    MatRowDef,
    MatTable,
    PageHeader,
    StatusBadge,
    TableSearch,
    TypeTag,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack">
      <app-page-header
        heading="رویداد های سیستم"
        description="هر ثبت، ویرایش و حذف در سامانه، با کاربر و زمان آن"
      />

      @if (!forbidden()) {
        <!-- The date range: presets, the two bounds and «اعمال بازه», on a low band. -->
        <div class="filter-bar" role="group" aria-label="بازهٔ زمانی">
          <app-date-range-presets
            label="بازه‌های آماده تاریخ و زمان رویداد"
            (rangeSelected)="onPresetSelected($event)"
          />

          <form
            novalidate
            class="filter-bar__form"
            (submit)="onApplyDateRange(); $event.preventDefault()"
          >
            <app-jalali-datetime-field
              [field]="dateRangeForm.from"
              [unparseable]="dateRangeForm.fromUnparseable"
              dateLabel="از تاریخ رویداد"
              timeLabel="از ساعت رویداد"
              boundName="آغاز بازه رویداد"
            />

            <app-jalali-datetime-field
              [field]="dateRangeForm.to"
              [unparseable]="dateRangeForm.toUnparseable"
              dateLabel="تا تاریخ رویداد"
              timeLabel="تا ساعت رویداد"
              boundName="پایان بازه رویداد"
            />

            <button matButton="outlined" type="submit">اعمال بازه</button>
            <button matButton type="button" (click)="onClearFilters()">پاک کردن فیلترها</button>
          </form>
        </div>
      }

      <app-data-sheet
        heading="رویدادها"
        [count]="loading() || listResource.error() || forbidden() ? null : total()"
        [loading]="loading()"
        loadingLabel="در حال بارگذاری رویدادهای سیستم"
      >
        @if (!forbidden()) {
          <app-table-search
            sheetSearch
            label="شناسه رکورد"
            [value]="recordIdQuery()"
            (valueChange)="onRecordIdTyped($event)"
          />
        }

        @if (!forbidden()) {
          <div sheetFilters class="sheet-filters" role="group" aria-label="فیلترهای گزارش">
            @for (field of listFilterFields; track field.key) {
              <app-filter-button
                [label]="field.label"
                [selectedCount]="selectedCount(field.key)"
                [disabled]="filterOptionsResource.isLoading()"
                (pressed)="openFilterDialog(field)"
              />
            }
          </div>
        }

        @if (!forbidden()) {
          <app-active-filters
            sheetChips
            [chips]="activeChips()"
            (removed)="onRemoveFilter($event)"
            (clearedAll)="onClearFilters()"
          />
        }

        @if (loading()) {
          <!-- The sheet's progress bar says it; nothing to draw until the answer arrives. -->
        } @else if (forbidden()) {
          <app-error-banner message="شما دسترسی لازم برای مشاهده این بخش را ندارید." />
        } @else if (listResource.error()) {
          <app-error-banner
            message="گزارش رویدادهای سیستم بارگذاری نشد."
            retryLabel="تلاش دوباره"
            (retry)="listResource.reload()"
          />
        } @else if (rows().length === 0) {
          <app-empty-state
            message="هیچ رویدادی یافت نشد."
            [actionLabel]="hasActiveFilters() ? 'پاک کردن فیلترها' : undefined"
            (action)="onClearFilters()"
          />
        } @else {
          <table mat-table [dataSource]="rows()">
            <ng-container matColumnDef="actorName">
              <th mat-header-cell *matHeaderCellDef>کاربر</th>
              <td mat-cell *matCellDef="let row">{{ row.actorName }}</td>
            </ng-container>

            <ng-container matColumnDef="occurredAt">
              <th mat-header-cell *matHeaderCellDef>
                <span class="cell-end">تاریخ و زمان</span>
              </th>
              <td mat-cell *matCellDef="let row">
                <span class="cell-end">{{ formatOccurredAt(row.occurredAt) }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="recordType">
              <th mat-header-cell *matHeaderCellDef>نوع رکورد</th>
              <td mat-cell *matCellDef="let row">
                <app-type-tag [label]="recordTypeLabel(row)" />
              </td>
            </ng-container>

            <ng-container matColumnDef="recordId">
              <th mat-header-cell *matHeaderCellDef>شناسه رکورد</th>
              <td mat-cell *matCellDef="let row">
                <app-copy-id-button
                  [entityId]="row.recordId"
                  [entityName]="row.recordId"
                  [short]="true"
                />
              </td>
            </ng-container>

            <ng-container matColumnDef="action">
              <th mat-header-cell *matHeaderCellDef>نوع رویداد</th>
              <td mat-cell *matCellDef="let row">
                <app-status-badge [kind]="actionKind(row)" [label]="actionLabel(row)" />
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef>
                <span class="visually-hidden">عملیات</span>
              </th>
              <td mat-cell *matCellDef="let row">
                <div class="cell-actions">
                  <button
                    matButton
                    class="button--small"
                    type="button"
                    [attr.aria-label]="'جزئیات تغییرات ' + row.recordId"
                    (click)="openChangesDialog(row)"
                  >
                    جزئیات
                  </button>
                </div>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
          </table>
        }

        @if (!loading() && !listResource.error() && !forbidden() && rows().length > 0) {
          <mat-paginator
            sheetFooter
            [length]="total()"
            [pageIndex]="pageIndex()"
            [pageSize]="pageSize()"
            [pageSizeOptions]="[10, 20, 50]"
            (page)="onPage($event)"
          />
        }
      </app-data-sheet>
    </div>
  `,
  styleUrl: './audit-log-page.scss',
})
export class AuditLogPage {
  private readonly gateway = inject(AuditLogGateway);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly displayedColumns = DISPLAYED_COLUMNS;
  protected readonly listFilterFields = LIST_FILTER_FIELDS;

  protected readonly pageSize = signal(DEFAULT_PAGE_SIZE);

  /** What the record-id search box shows, keystroke by keystroke. */
  protected readonly recordIdQuery = signal('');

  /** What the server was last asked for: `recordIdQuery` once typing has paused for a moment. */
  private readonly appliedRecordId = signal('');
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  private readonly listFilters = signal<AppAuditLogFilters>(NO_LIST_FILTERS);
  private readonly dateRangeFilters = signal<DateRangeFilters>(NO_DATE_RANGE);

  /** Any change to what is asked for sends the log back to its first page; paging itself writes it. */
  protected readonly pageIndex = linkedSignal<unknown, number>({
    source: () => [this.listFilters(), this.dateRangeFilters(), this.appliedRecordId()],
    computation: () => 0,
  });

  private readonly filters = computed<AppAuditLogFilters>(() => {
    const recordId = this.appliedRecordId().trim();
    return {
      ...this.listFilters(),
      ...this.dateRangeFilters(),
      ...(recordId === '' ? {} : { recordId }),
    };
  });

  protected readonly listResource = rxResource({
    params: () => ({
      page: this.pageIndex() + 1,
      pageSize: this.pageSize(),
      filters: this.filters(),
    }),
    stream: ({ params }) => this.gateway.list(params.page, params.pageSize, params.filters),
    defaultValue: { items: [], total: 0 } as AppAuditLogPage,
  });

  protected readonly filterOptionsResource = rxResource({
    stream: () => this.gateway.filterOptions(),
    defaultValue: { actors: [], recordTypes: [], actions: [] } as AppAuditLogFilterOptions,
  });

  protected readonly loading = computed(() => this.listResource.isLoading());
  protected readonly rows = computed<AppAuditLogEntry[]>(() =>
    this.listResource.hasValue() ? this.listResource.value().items : [],
  );
  protected readonly total = computed(() =>
    this.listResource.hasValue() ? this.listResource.value().total : 0,
  );

  protected readonly forbidden = computed(() => {
    const error = this.listResource.error();
    return error instanceof HttpErrorResponse && error.status === 403;
  });

  private readonly dateRangeModel = signal<DateRangeFormModel>(EMPTY_DATE_RANGE);

  protected readonly dateRangeForm = form(this.dateRangeModel, dateRangeSchema);

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.searchTimer));
  }

  protected recordTypeLabel(entry: AppAuditLogEntry): string {
    return RECORD_TYPE_LABELS[entry.recordType];
  }

  protected actionLabel(entry: AppAuditLogEntry): string {
    return ACTION_LABELS[entry.action];
  }

  protected actionKind(entry: AppAuditLogEntry): 'create' | 'update' | 'delete' {
    return ACTION_KINDS[entry.action];
  }

  protected formatOccurredAt(iso: string): string {
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime()) ? '—' : formatJalaliDateTime(parsed);
  }

  protected onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  /** Applies a search still waiting out its pause, so a second filter does not fire a request of its own later. */
  private flushPendingSearch(): void {
    if (this.searchTimer !== undefined) {
      clearTimeout(this.searchTimer);
      this.searchTimer = undefined;
      this.appliedRecordId.set(this.recordIdQuery());
    }
  }

  /** The search filters as you type, but asks the server only once typing has paused. */
  protected onRecordIdTyped(text: string): void {
    this.recordIdQuery.set(text);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.searchTimer = undefined;
      this.appliedRecordId.set(text);
    }, SEARCH_DEBOUNCE_MS);
  }

  protected onApplyDateRange(): Promise<boolean> {
    this.flushPendingSearch();
    return submit(this.dateRangeForm, async () => {
      this.dateRangeFilters.set(toIsoDateRange(this.dateRangeModel()));
      return undefined;
    });
  }

  /** A preset fills the two date fields and applies at once, leaving the page's other filters as
   * they are — it is a shortcut for the range, not a reset of the form. */
  protected onPresetSelected(range: DateRange): void {
    this.dateRangeModel.set(appliedDateRange(range.from, range.to));
    void this.onApplyDateRange();
  }

  /** How many values are chosen for a field; 0 while it has no filter. */
  protected selectedCount(key: ListFilterKey): number {
    return this.listFilters()[key]?.length ?? 0;
  }

  /** One chip per chosen value: «نوع رویداد: ثبت» and «نوع رویداد: حذف», each removable on its own. */
  protected readonly activeChips = computed<readonly ActiveFilterChip[]>(() =>
    multiValueFilterChips(LIST_FILTER_FIELDS, this.listFilters(), (key, value) =>
      this.labelFor(key, value),
    ),
  );

  protected readonly hasActiveFilters = computed(() => {
    const { from, to } = this.dateRangeFilters();
    return (
      this.activeChips().length > 0 ||
      this.appliedRecordId().trim() !== '' ||
      from !== undefined ||
      to !== undefined
    );
  });

  protected onRemoveFilter(chip: ActiveFilterChip): void {
    this.flushPendingSearch();
    this.listFilters.update((current) => withoutFilterValue(current, chip));
  }

  protected onClearFilters(): void {
    clearTimeout(this.searchTimer);
    this.recordIdQuery.set('');
    this.appliedRecordId.set('');
    this.dateRangeModel.set(EMPTY_DATE_RANGE);
    this.dateRangeFilters.set(NO_DATE_RANGE);
    this.listFilters.set(NO_LIST_FILTERS);
  }

  protected openFilterDialog(field: ListFilterField): void {
    const options = this.filterOptionsResource.value();
    const data: AuditLogFilterDialogData = {
      fieldLabel: field.label,
      options: this.optionsFor(field.key, options),
      selectedValues: this.listFilters()[field.key],
    };

    this.dialog
      .open(AuditLogFilterDialog, { data })
      .afterClosed()
      .subscribe((result: AuditLogFilterDialogResult | '' | undefined) => {
        if (!result) {
          return;
        }
        this.listFilters.update((current) => ({ ...current, [field.key]: result.selected }));
      });
  }

  /** The words a visitor reads for one chosen value of a list field. */
  private labelFor(key: ListFilterKey, value: string): string {
    switch (key) {
      case 'actors':
        return value;
      case 'recordTypes':
        return RECORD_TYPE_LABELS[value as AppRecordType];
      case 'actions':
        return ACTION_LABELS[value as AppAuditAction];
    }
  }

  private optionsFor(key: ListFilterKey, options: AppAuditLogFilterOptions) {
    switch (key) {
      case 'actors':
        return options.actors.map((value) => ({ value, label: value }));
      case 'recordTypes':
        return options.recordTypes.map((value: AppRecordType) => ({
          value,
          label: RECORD_TYPE_LABELS[value],
        }));
      case 'actions':
        return options.actions.map((value: AppAuditAction) => ({
          value,
          label: ACTION_LABELS[value],
        }));
    }
  }

  protected openChangesDialog(entry: AppAuditLogEntry): void {
    const data: AuditLogChangesDialogData = {
      id: entry.id,
      actorName: entry.actorName,
      recordTypeLabel: this.recordTypeLabel(entry),
      action: entry.action,
      occurredAt: entry.occurredAt,
    };
    this.dialog.open(AuditLogChangesDialog, { data });
  }
}
