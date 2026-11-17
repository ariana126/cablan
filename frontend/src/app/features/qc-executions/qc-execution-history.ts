import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { rxResource, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { form } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
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
import { debounceTime, distinctUntilChanged, map } from 'rxjs';

import { formatJalaliCalendarDate, toIsoCalendarDate } from '../../core/date/calendar-date';
import {
  dateRangeSchema,
  DateRangeFormModel,
  EMPTY_DATE_RANGE,
} from '../../core/date/date-range-form';
import {
  AppQcExecution,
  AppQcExecutionCount,
  AppQcExecutionFilterOptions,
  AppQcExecutionHistory,
  QcExecutionsGateway,
} from '../../core/qc/qc-executions-gateway';
import { formatQcInterval } from '../../core/qc/qc-interval';
import { ActiveFilters } from '../../ui/active-filters/active-filters';
import { ActiveFilterChip } from '../../ui/active-filters/active-filter-chips';
import { DataSheet } from '../../ui/data-sheet/data-sheet';
import { EmptyState } from '../../ui/empty-state/empty-state';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { Icon } from '../../ui/icon/icon';
import { JalaliDatetimeField } from '../../ui/jalali-datetime-field/jalali-datetime-field';
import { PersianNumberPipe } from '../../ui/persian-number/persian-number-pipe';
import { QcExecutionDetailsDialog } from './qc-execution-details-dialog';
import { NO_QC_HISTORY_FILTER, toQcExecutionFilters } from './qc-history-filters';
import { qcTime } from '../../core/qc/qc-time';

type ChipKey = 'equipment' | 'activity' | 'performer' | 'trackingNumber' | 'from' | 'to';

/** How long typing in «شماره ردیابی» pauses before the records are asked for again. */
const TYPING_PAUSE_MS = 400;

const NO_OPTIONS: AppQcExecutionFilterOptions = { equipment: [], activities: [], performers: [] };

let nextId = 0;

/**
 * The QC records (issue #119), shared by an equipment's QC folder («سوابق انجام فعالیت‌ها», its
 * `equipmentId` fixed) and the plant-wide report (`/qc-executions`, `equipmentId` `null`: an
 * «تجهیز» filter and column of its own).
 *
 * Filters, ANDed by the API and combinable: «از تاریخ» / «تا تاریخ» (whole Tehran days), «تجهیز»
 * (report only), «فعالیت», «ثبت کننده» and «شماره ردیابی» (contains, asked once typing pauses);
 * each set one is a removable chip. Under them, the number of records per activity (per equipment in
 * the report) under the same filters, then the records, newest first: activity, who recorded it,
 * when (Tehran's clock), and the interval since the previous record of that activity on that
 * equipment — which the API computes over every record, so no filter changes it.
 *
 * A row opens the record in full (`QcExecutionDetailsDialog`) through its «جزئیات» button, whose hit
 * area covers the row; there the System Admin may delete it, after which the records are read again
 * and `changed` tells the folder its last executions moved.
 */
@Component({
  selector: 'app-qc-execution-history',
  imports: [
    ActiveFilters,
    DataSheet,
    EmptyState,
    ErrorBanner,
    Icon,
    JalaliDatetimeField,
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
    MatInput,
    MatLabel,
    MatOption,
    MatRow,
    MatRowDef,
    MatSelect,
    MatTable,
    PersianNumberPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-data-sheet
      [heading]="heading()"
      [count]="shown() === undefined ? null : executions().length"
      [loading]="historyResource.isLoading()"
      loadingLabel="در حال بارگذاری سوابق QC"
    >
      <div sheetFilters class="qc-filters">
        @if (equipmentId() === null) {
          <mat-form-field class="qc-filters__pick" appearance="outline" subscriptSizing="dynamic">
            <mat-label>تجهیز</mat-label>
            <mat-select [(value)]="equipmentFilter">
              <mat-option value="">همه</mat-option>
              @for (option of options().equipment; track option.id) {
                <mat-option [value]="option.id">{{ equipmentLabel(option) }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }
        <mat-form-field class="qc-filters__pick" appearance="outline" subscriptSizing="dynamic">
          <mat-label>فعالیت</mat-label>
          <mat-select [(value)]="activityFilter">
            <mat-option value="">همه</mat-option>
            @for (option of options().activities; track option.id) {
              <mat-option [value]="option.id">{{ option.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field class="qc-filters__pick" appearance="outline" subscriptSizing="dynamic">
          <mat-label>ثبت کننده</mat-label>
          <mat-select [(value)]="performerFilter">
            <mat-option value="">همه</mat-option>
            @for (option of options().performers; track option.id) {
              <mat-option [value]="option.id">{{ option.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field class="qc-filters__pick" appearance="outline" subscriptSizing="dynamic">
          <mat-label>شماره ردیابی</mat-label>
          <input
            matInput
            type="text"
            autocomplete="off"
            [value]="trackingInput()"
            (input)="trackingInput.set($any($event.target).value)"
          />
        </mat-form-field>
        <form
          novalidate
          class="qc-filters__range"
          aria-label="بازهٔ زمانی سوابق"
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
      <app-active-filters
        sheetChips
        [chips]="chips()"
        (removed)="removeFilter($event)"
        (clearedAll)="clearFilters()"
      />

      @if (historyResource.error()) {
        <app-error-banner
          message="سوابق QC بارگذاری نشد."
          retryLabel="تلاش دوباره"
          (retry)="historyResource.reload()"
        />
      } @else if (shown() === undefined) {
        <!-- The first read: the sheet's progress bar says it. A new filter keeps the rows on screen. -->
      } @else if (executions().length === 0 && chips().length === 0) {
        <app-empty-state message="هنوز سابقه‌ای ثبت نشده است." />
      } @else if (executions().length === 0) {
        <app-empty-state
          message="سابقه‌ای با این فیلترها یافت نشد."
          actionLabel="پاک کردن فیلترها"
          (action)="clearFilters()"
        />
      } @else {
        <div class="qc-history stack stack--tight">
          <section class="qc-history__part stack stack--tight" [attr.aria-labelledby]="countsId">
            <h3 class="qc-history__title" [id]="countsId">تعداد انجام به تفکیک فعالیت</h3>
            <table mat-table [dataSource]="counts()">
              <ng-container matColumnDef="equipment">
                <th mat-header-cell *matHeaderCellDef>تجهیز</th>
                <td mat-cell *matCellDef="let count">{{ count.equipmentName }}</td>
              </ng-container>
              <ng-container matColumnDef="activity">
                <th mat-header-cell *matHeaderCellDef>فعالیت</th>
                <td mat-cell *matCellDef="let count">{{ count.activityName }}</td>
              </ng-container>
              <ng-container matColumnDef="count">
                <th mat-header-cell *matHeaderCellDef><span class="cell-end">تعداد</span></th>
                <td mat-cell *matCellDef="let count">
                  <span class="cell-end">{{ count.count | persianNumber }}</span>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="countColumns()"></tr>
              <tr mat-row *matRowDef="let row; columns: countColumns()"></tr>
            </table>
          </section>

          <section class="qc-history__part stack stack--tight" [attr.aria-labelledby]="recordsId">
            <h3 #recordsHeading class="qc-history__title" [id]="recordsId" tabindex="-1">
              فهرست سوابق
            </h3>
            <p class="qc-history__hint">برای دیدن جزئیات هر سابقه روی ردیف آن کلیک کنید.</p>
            <table mat-table class="qc-history__records" [dataSource]="executions()">
              <ng-container matColumnDef="equipment">
                <th mat-header-cell *matHeaderCellDef>تجهیز</th>
                <td mat-cell *matCellDef="let execution">{{ execution.equipmentName }}</td>
              </ng-container>
              <ng-container matColumnDef="activity">
                <th mat-header-cell *matHeaderCellDef>فعالیت</th>
                <td mat-cell *matCellDef="let execution" class="qc-history__activity">
                  {{ execution.activityName }}
                </td>
              </ng-container>
              <ng-container matColumnDef="performedBy">
                <th mat-header-cell *matHeaderCellDef>ثبت کننده</th>
                <td mat-cell *matCellDef="let execution">{{ execution.performedByName }}</td>
              </ng-container>
              <ng-container matColumnDef="performedAt">
                <th mat-header-cell *matHeaderCellDef><span class="cell-end">زمان انجام</span></th>
                <td mat-cell *matCellDef="let execution">
                  <span class="cell-end">{{ time(execution.performedAt) }}</span>
                </td>
              </ng-container>
              <ng-container matColumnDef="interval">
                <th mat-header-cell *matHeaderCellDef>
                  <span class="cell-end">فاصله از انجام قبلی</span>
                </th>
                <td mat-cell *matCellDef="let execution">
                  <span
                    class="cell-end"
                    [class.qc-history__none]="execution.intervalMinutes === null"
                    >{{ interval(execution.intervalMinutes) }}</span
                  >
                </td>
              </ng-container>
              <!-- The row's one control: its hit area is stretched over the row. -->
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>
                  <span class="visually-hidden">عملیات</span>
                </th>
                <td mat-cell *matCellDef="let execution">
                  <div class="cell-actions">
                    <button
                      matButton
                      class="button--small qc-history__open"
                      type="button"
                      [attr.aria-label]="
                        'جزئیات ' + execution.activityName + ' ' + time(execution.performedAt)
                      "
                      (click)="openDetails(execution)"
                    >
                      <mat-icon appIcon="details" />
                      جزئیات
                    </button>
                  </div>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="recordColumns()"></tr>
              <tr mat-row *matRowDef="let row; columns: recordColumns()"></tr>
            </table>
          </section>
        </div>
      }
    </app-data-sheet>
  `,
  styleUrl: './qc-execution-history.scss',
})
export class QcExecutionHistory {
  private readonly gateway = inject(QcExecutionsGateway);
  private readonly dialog = inject(MatDialog);

  /** The folder's equipment, or `null` for every equipment (the report). */
  readonly equipmentId = input.required<string | null>();
  /** The data sheet's heading. */
  readonly heading = input.required<string>();
  /** The System Admin deletes records; nobody else is offered it. */
  readonly canDelete = input(false);

  /** After a record was deleted — the folder re-reads its last executions. */
  readonly changed = output<void>();

  private readonly id = nextId++;
  protected readonly countsId = `qc-history-counts-${this.id}`;
  protected readonly recordsId = `qc-history-records-${this.id}`;
  private readonly recordsHeading = viewChild<ElementRef<HTMLElement>>('recordsHeading');

  protected readonly time = qcTime;
  protected readonly interval = formatQcInterval;

  protected readonly optionsResource = rxResource({
    stream: () => this.gateway.filterOptions(),
    defaultValue: NO_OPTIONS,
  });
  protected readonly options = computed(() =>
    this.optionsResource.hasValue() ? this.optionsResource.value() : NO_OPTIONS,
  );

  /** `''` is «همه». */
  protected readonly equipmentFilter = signal('');
  protected readonly activityFilter = signal('');
  protected readonly performerFilter = signal('');
  /** As typed; the request follows once typing pauses. */
  protected readonly trackingInput = signal('');
  private readonly trackingNumber = toSignal(
    toObservable(this.trackingInput).pipe(
      debounceTime(TYPING_PAUSE_MS),
      map((value) => value.trim()),
      distinctUntilChanged(),
    ),
    { initialValue: '' },
  );

  private readonly rangeModel = signal<DateRangeFormModel>(EMPTY_DATE_RANGE);
  protected readonly rangeForm = form(this.rangeModel, dateRangeSchema);

  private readonly filters = computed(() => {
    // A back-to-front range is explained under its field and asks nothing meanwhile.
    const { from, to } = this.rangeForm().valid() ? this.rangeModel() : EMPTY_DATE_RANGE;
    return toQcExecutionFilters({
      ...NO_QC_HISTORY_FILTER,
      from,
      to,
      equipmentId: this.equipmentId() ?? this.equipmentFilter(),
      activityId: this.activityFilter(),
      performedById: this.performerFilter(),
      trackingNumber: this.trackingNumber(),
    });
  });

  protected readonly historyResource = rxResource({
    params: () => this.filters(),
    stream: ({ params }) => this.gateway.history(params),
  });

  /** The records last read for this equipment, kept on screen while new filters are being read. */
  protected readonly shown = linkedSignal<
    { equipmentId: string | null; value: AppQcExecutionHistory | undefined },
    AppQcExecutionHistory | undefined
  >({
    source: () => ({
      equipmentId: this.equipmentId(),
      value: this.historyResource.hasValue() ? this.historyResource.value() : undefined,
    }),
    computation: (source, previous) =>
      source.value ??
      (previous !== undefined && previous.source.equipmentId === source.equipmentId
        ? previous.value
        : undefined),
  });

  protected readonly executions = computed<readonly AppQcExecution[]>(
    () => this.shown()?.executions ?? [],
  );
  protected readonly counts = computed<readonly AppQcExecutionCount[]>(
    () => this.shown()?.counts ?? [],
  );

  protected readonly countColumns = computed(() =>
    this.equipmentId() === null ? ['equipment', 'activity', 'count'] : ['activity', 'count'],
  );
  protected readonly recordColumns = computed(() => [
    ...(this.equipmentId() === null ? ['equipment'] : []),
    'activity',
    'performedBy',
    'performedAt',
    'interval',
    'actions',
  ]);

  protected readonly chips = computed<ActiveFilterChip[]>(() => {
    const options = this.options();
    const nameOf = (list: readonly { id: string; name: string }[], id: string) =>
      list.find((option) => option.id === id)?.name ?? id;
    const { from, to } = this.rangeModel();
    const chips: ActiveFilterChip[] = [];
    if (this.equipmentId() === null && this.equipmentFilter() !== '') {
      chips.push(chip('equipment', 'تجهیز', nameOf(options.equipment, this.equipmentFilter())));
    }
    if (this.activityFilter() !== '') {
      chips.push(chip('activity', 'فعالیت', nameOf(options.activities, this.activityFilter())));
    }
    if (this.performerFilter() !== '') {
      chips.push(
        chip('performer', 'ثبت کننده', nameOf(options.performers, this.performerFilter())),
      );
    }
    if (this.trackingNumber() !== '') {
      chips.push(chip('trackingNumber', 'شماره ردیابی', this.trackingNumber()));
    }
    if (from !== null) {
      chips.push(chip('from', 'از تاریخ', jalaliDay(from)));
    }
    if (to !== null) {
      chips.push(chip('to', 'تا تاریخ', jalaliDay(to)));
    }
    return chips;
  });

  protected equipmentLabel(option: { name: string; retired: boolean }): string {
    return option.retired ? `${option.name} (کنار گذاشته شده)` : option.name;
  }

  protected removeFilter(removed: ActiveFilterChip): void {
    switch (removed.filterKey as ChipKey) {
      case 'equipment':
        this.equipmentFilter.set('');
        break;
      case 'activity':
        this.activityFilter.set('');
        break;
      case 'performer':
        this.performerFilter.set('');
        break;
      case 'trackingNumber':
        this.trackingInput.set('');
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
    this.equipmentFilter.set('');
    this.activityFilter.set('');
    this.performerFilter.set('');
    this.trackingInput.set('');
    this.rangeModel.set(EMPTY_DATE_RANGE);
  }

  /**
   * Re-reads the records and the filter options — after the folder changed something they depend on
   * (a new assignment brings a new activity to filter by).
   */
  reload(): void {
    this.historyResource.reload();
    this.optionsResource.reload();
  }

  protected openDetails(execution: AppQcExecution): void {
    this.dialog
      .open(QcExecutionDetailsDialog, { data: { execution, canDelete: this.canDelete() } })
      .afterClosed()
      .subscribe((outcome) => {
        if (outcome !== 'deleted') {
          return;
        }
        // The deleted record may have been the last of its recorder or activity.
        this.reload();
        this.changed.emit();
        // The row and its button are gone; the list's own heading takes focus instead of <body>.
        this.recordsHeading()?.nativeElement.focus();
      });
  }
}

const jalaliDay = (day: Date): string => formatJalaliCalendarDate(toIsoCalendarDate(day));

function chip(key: ChipKey, column: string, value: string): ActiveFilterChip {
  return {
    id: key,
    filterKey: key,
    filterValue: value,
    column,
    value,
    removeLabel: `حذف فیلتر ${column}: ${value}`,
  };
}
