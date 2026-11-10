import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  input,
  output,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { form } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatOption, MatSelect } from '@angular/material/select';
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

import { formatJalaliCalendarDate, toIsoCalendarDate } from '../../core/date/calendar-date';
import {
  dateRangeSchema,
  DateRangeFormModel,
  EMPTY_DATE_RANGE,
} from '../../core/date/date-range-form';
import { formatJalaliDateTime } from '../../core/date/jalali-datetime';
import { ActivitySpecialty, SPECIALTY_LABELS } from '../../core/i18n/specialty-labels';
import {
  AppMaintenanceExecution,
  AppMaintenanceHistoryEntry,
  EquipmentGateway,
} from '../../core/maintenance/equipment-gateway';
import { ActiveFilters } from '../../ui/active-filters/active-filters';
import { ActiveFilterChip } from '../../ui/active-filters/active-filter-chips';
import { DataSheet } from '../../ui/data-sheet/data-sheet';
import { EmptyState } from '../../ui/empty-state/empty-state';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { Icon } from '../../ui/icon/icon';
import { JalaliDatetimeField } from '../../ui/jalali-datetime-field/jalali-datetime-field';
import { PmStatusBadge } from '../../ui/pm-status-badge/pm-status-badge';
import { TableSearch } from '../../ui/table-search/table-search';
import { filterHistory, historyRange } from './history-filter';
import { ConfirmDeletePmExecutionDialog } from './confirm-delete-pm-execution-dialog';
import { PmExecutionDetailsDialog } from './pm-execution-details-dialog';

const COLUMNS = ['activity', 'dueDate', 'performedBy', 'performedAt', 'status', 'details'];

/** «برق» and «مکانیک», after «همه» (`''`). */
const SPECIALTY_CHOICES = (Object.keys(SPECIALTY_LABELS) as ActivitySpecialty[]).map((value) => ({
  value,
  label: SPECIALTY_LABELS[value],
}));

type HistoryChipKey = 'query' | 'specialty' | 'from' | 'to';

/** What a cell shows for a value that is not there, as the other report pages do. */
const NONE = '—';

/** Who did a missed due date, and when: a plain hyphen, as the business table writes it (issue #114). */
const NOT_DONE = '-';

/**
 * «سابقه PM» — the history section of an equipment's folder (issue #92): every PM recorded on it,
 * newest first, executions of deactivated items and of a retired equipment included. The notes are too
 * long for a row; each row's «جزئیات» opens the whole record. For the System Admin each row also
 * offers «حذف سابقه» (issue #110), behind a confirmation.
 *
 * It reads its own data, keyed on `equipmentId`, so it stands on its own in the folder — the way
 * every later section (failures, repairs, parts, documents) will.
 *
 * Issue #112 added filters, ANDed, each active one a removable chip, with «پاک کردن همه»; the count
 * is what is left. Issue #114 added the due dates nobody did: a missed row reads «انجام نشده», «-»
 * for who and when, an error stripe on its start edge, and offers neither «جزئیات» nor «حذف
 * سابقه». «جستجوی فعالیت» and «تخصص» narrow both kinds in the browser (`filterHistory`); «از
 * تاریخ» / «تا تاریخ» go to the API as `from`/`to` (`historyRange`), which places work by the day
 * it was done and a missed occurrence by its due date. The rows last read stay on screen while a
 * new range is read.
 */
@Component({
  selector: 'app-pm-history-section',
  imports: [
    ActiveFilters,
    DataSheet,
    EmptyState,
    ErrorBanner,
    Icon,
    JalaliDatetimeField,
    MatButton,
    MatFormField,
    MatLabel,
    MatOption,
    MatSelect,
    TableSearch,
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
    PmStatusBadge,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-data-sheet
      heading="سابقه PM"
      [count]="shown() === undefined ? null : rows().length"
      [loading]="historyResource.isLoading()"
      loadingLabel="در حال بارگذاری سابقهٔ PM"
    >
      <!-- One block per slot: a control-flow block is projected into a named slot only when it has
           a single root; with more, everything falls into the sheet's body. -->
      @if (filtersShown()) {
        <app-table-search ngProjectAs="[sheetSearch]" label="جستجوی فعالیت" [(value)]="query" />
      }
      @if (filtersShown()) {
        <div sheetFilters class="history-filters">
          <mat-form-field
            class="history-filters__specialty"
            appearance="outline"
            subscriptSizing="dynamic"
          >
            <mat-label>تخصص</mat-label>
            <mat-select [(value)]="specialty">
              <mat-option value="">همه</mat-option>
              @for (choice of specialtyChoices; track choice.value) {
                <mat-option [value]="choice.value">{{ choice.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <form
            novalidate
            class="history-filters__range"
            aria-label="بازهٔ زمانی سابقه"
            (submit)="$event.preventDefault()"
          >
            <app-jalali-datetime-field
              [field]="rangeForm.from"
              dateLabel="از تاریخ"
              boundName="از تاریخ"
              [withTime]="false"
              subscriptSizing="dynamic"
            />
            <app-jalali-datetime-field
              [field]="rangeForm.to"
              dateLabel="تا تاریخ"
              boundName="تا تاریخ"
              [withTime]="false"
              subscriptSizing="dynamic"
            />
          </form>
        </div>
      }
      @if (filtersShown()) {
        <app-active-filters
          sheetChips
          [chips]="chips()"
          (removed)="removeFilter($event)"
          (clearedAll)="clearFilters()"
        />
      }

      @if (historyResource.error()) {
        <app-error-banner
          message="سابقهٔ PM بارگذاری نشد."
          retryLabel="تلاش دوباره"
          (retry)="historyResource.reload()"
        />
      } @else if (shown() === undefined) {
        <!-- The first read: the sheet's progress bar says it. A new range keeps the rows on screen. -->
      } @else if (history().length === 0 && !rangeChosen()) {
        <app-empty-state message="هنوز انجامی برای این تجهیز ثبت نشده است." />
      } @else if (rows().length === 0) {
        <app-empty-state
          message="سابقه‌ای با این فیلترها یافت نشد."
          actionLabel="پاک کردن فیلترها"
          (action)="clearFilters()"
        />
      } @else {
        <table mat-table [dataSource]="rows()">
          <ng-container matColumnDef="activity">
            <th mat-header-cell *matHeaderCellDef>فعالیت</th>
            <td mat-cell *matCellDef="let execution" [id]="cellId(execution, 'activity')">
              {{ execution.activityName }}
            </td>
          </ng-container>

          <ng-container matColumnDef="dueDate">
            <th mat-header-cell *matHeaderCellDef>
              <span class="cell-end">موعد</span>
            </th>
            <td mat-cell *matCellDef="let execution" [id]="cellId(execution, 'due')">
              <span class="cell-end">{{ jalaliDate(execution.dueDate) }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="performedBy">
            <th mat-header-cell *matHeaderCellDef>انجام دهنده</th>
            <td mat-cell *matCellDef="let execution">
              {{ execution.kind === 'executed' ? execution.performedBy : notDone }}
            </td>
          </ng-container>

          <ng-container matColumnDef="performedAt">
            <th mat-header-cell *matHeaderCellDef>
              <span class="cell-end">زمان انجام</span>
            </th>
            <td mat-cell *matCellDef="let execution">
              <span class="cell-end">{{ performedAt(execution) }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>وضعیت</th>
            <td mat-cell *matCellDef="let execution">
              <app-pm-status-badge [status]="execution.status" />
            </td>
          </ng-container>

          <!-- Named by activity and due date, so each row's button is told apart from the others'. -->
          <ng-container matColumnDef="details">
            <th mat-header-cell *matHeaderCellDef>
              <span class="visually-hidden">عملیات</span>
            </th>
            <td mat-cell *matCellDef="let execution">
              <!-- A missed due date has no record to open and nothing to delete. -->
              @if (execution.kind === 'executed') {
                <div class="cell-actions">
                  <button
                    matButton
                    class="button--small"
                    type="button"
                    [attr.aria-label]="
                      'جزئیات ' + execution.activityName + ' ' + jalaliDate(execution.dueDate)
                    "
                    (click)="openDetails(execution)"
                  >
                    <mat-icon appIcon="details" />
                    جزئیات
                  </button>
                  <!-- Named exactly «حذف سابقه», told apart by its row's activity and due date. -->
                  @if (canDelete()) {
                    <button
                      matButton
                      class="button--small button--danger"
                      type="button"
                      [attr.aria-describedby]="
                        cellId(execution, 'activity') + ' ' + cellId(execution, 'due')
                      "
                      (click)="openDelete(execution)"
                    >
                      <mat-icon appIcon="delete" />
                      حذف سابقه
                    </button>
                  }
                </div>
              }
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr
            mat-row
            *matRowDef="let row; columns: columns"
            [class.history-row--missed]="row.kind === 'missed'"
          ></tr>
        </table>
      }
    </app-data-sheet>
  `,
  styleUrl: './pm-history-section.scss',
})
export class PmHistorySection {
  private readonly gateway = inject(EquipmentGateway);
  private readonly dialog = inject(MatDialog);

  readonly equipmentId = input.required<string>();
  /** For the details dialog's subtitle. */
  readonly equipmentName = input.required<string>();
  /** The System Admin deletes executions (issue #110); nobody else is offered it. */
  readonly canDelete = input(false);

  /** After an execution was deleted — the folder re-reads the plan, whose next due date moves. */
  readonly changed = output<void>();

  private static nextId = 0;
  private readonly idPrefix = `pm-history-${PmHistorySection.nextId++}`;

  protected readonly columns = COLUMNS;
  protected readonly jalaliDate = formatJalaliCalendarDate;

  protected readonly notDone = NOT_DONE;

  protected readonly specialtyChoices = SPECIALTY_CHOICES;
  protected readonly query = signal('');
  /** `''` is «همه». */
  protected readonly specialty = signal<ActivitySpecialty | ''>('');
  private readonly rangeModel = signal<DateRangeFormModel>(EMPTY_DATE_RANGE);
  protected readonly rangeForm = form(this.rangeModel, dateRangeSchema);

  /**
   * The days asked of the API (issue #114) — none while no day is chosen, and none while a
   * back-to-front range is on screen (its error says why), so the whole history shows meanwhile.
   */
  private readonly range = computed(() => {
    const { from, to } = this.rangeModel();
    return this.rangeForm().valid() ? historyRange(from, to) : undefined;
  });

  /** Whether a day of the range is chosen — a narrowed history, even when nothing fell in it. */
  protected readonly rangeChosen = computed(() => {
    const { from, to } = this.rangeModel();
    return from !== null || to !== null;
  });

  protected readonly historyResource = rxResource({
    params: () => ({ id: this.equipmentId(), range: this.range() }),
    stream: ({ params }) => this.gateway.maintenanceHistory(params.id, params.range),
  });

  /**
   * The history last read for this equipment: kept on screen while a new range is being read, so
   * the filters stay put, and `undefined` only until the equipment's first answer.
   */
  protected readonly shown = linkedSignal<
    { id: string; value: AppMaintenanceHistoryEntry[] | undefined },
    AppMaintenanceHistoryEntry[] | undefined
  >({
    source: () => ({
      id: this.equipmentId(),
      value: this.historyResource.hasValue() ? this.historyResource.value() : undefined,
    }),
    computation: (source, previous) =>
      source.value ??
      (previous !== undefined && previous.source.id === source.id ? previous.value : undefined),
  });

  protected readonly history = computed<AppMaintenanceHistoryEntry[]>(() => this.shown() ?? []);

  /** The filters show while there is a history to narrow — or a range that left none. */
  protected readonly filtersShown = computed(() => this.history().length > 0 || this.rangeChosen());

  /** What the name search and «تخصص» leave of the history read, done and missed alike. */
  protected readonly rows = computed<AppMaintenanceHistoryEntry[]>(() =>
    filterHistory(this.history(), { query: this.query(), specialty: this.specialty() }),
  );

  protected readonly chips = computed<ActiveFilterChip[]>(() => {
    const query = this.query().trim();
    const specialty = this.specialty();
    const { from, to } = this.rangeModel();
    const chips: ActiveFilterChip[] = [];
    if (query !== '') {
      chips.push(historyChip('query', 'جستجو', query));
    }
    if (specialty !== '') {
      chips.push(historyChip('specialty', 'تخصص', SPECIALTY_LABELS[specialty]));
    }
    if (from !== null) {
      chips.push(historyChip('from', 'از تاریخ', jalaliDay(from)));
    }
    if (to !== null) {
      chips.push(historyChip('to', 'تا تاریخ', jalaliDay(to)));
    }
    return chips;
  });

  protected removeFilter(chip: ActiveFilterChip): void {
    switch (chip.filterKey as HistoryChipKey) {
      case 'query':
        this.query.set('');
        break;
      case 'specialty':
        this.specialty.set('');
        break;
      case 'from':
        this.rangeModel.update((range) => ({ ...range, from: null }));
        break;
      case 'to':
        this.rangeModel.update((range) => ({ ...range, to: null }));
        break;
    }
  }

  protected clearFilters(): void {
    this.query.set('');
    this.specialty.set('');
    this.rangeModel.set(EMPTY_DATE_RANGE);
  }

  /** In the viewer's own time zone, like every other instant the app shows; «-» when missed. */
  protected performedAt(entry: AppMaintenanceHistoryEntry): string {
    if (entry.kind === 'missed') {
      return NOT_DONE;
    }
    const performed = new Date(entry.performedAt);
    return Number.isNaN(performed.getTime()) ? NONE : formatJalaliDateTime(performed);
  }

  /** Re-reads the history — after the plan section deleted executions with their row. */
  reload(): void {
    this.historyResource.reload();
  }

  /** Unique per row: a missed entry has no id, but a plan row's due date occurs once. */
  protected cellId(entry: AppMaintenanceHistoryEntry, column: 'activity' | 'due'): string {
    const key =
      entry.kind === 'executed' ? entry.id : `missed-${entry.planItemId}-${entry.dueDate}`;
    return `${this.idPrefix}-${key}-${column}`;
  }

  protected openDelete(execution: AppMaintenanceExecution): void {
    this.dialog
      .open(ConfirmDeletePmExecutionDialog, {
        data: { equipmentId: this.equipmentId(), execution },
      })
      .afterClosed()
      .subscribe((deleted) => {
        if (deleted === true) {
          this.historyResource.reload();
          this.changed.emit();
        }
      });
  }

  /** The record in full, notes included; read-only, so focus simply returns to the button. */
  protected openDetails(execution: AppMaintenanceExecution): void {
    this.dialog.open(PmExecutionDetailsDialog, {
      data: { equipmentName: this.equipmentName(), execution },
    });
  }
}

const jalaliDay = (day: Date): string => formatJalaliCalendarDate(toIsoCalendarDate(day));

function historyChip(key: HistoryChipKey, column: string, value: string): ActiveFilterChip {
  return {
    id: key,
    filterKey: key,
    filterValue: value,
    column,
    value,
    removeLabel: `حذف فیلتر ${column}: ${value}`,
  };
}
