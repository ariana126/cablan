import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { apply, form, FormField, required } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatOption, MatSelect } from '@angular/material/select';

import { toIsoCalendarDate } from '../../core/date/calendar-date';
import { dateRangeSchema, DateRangeFormModel } from '../../core/date/date-range-form';
import { JalaliMonth } from '../../core/date/jalali-month';
import { tehranToday } from '../../core/date/tehran-today';
import { PM_STATUS_LABELS, PmOccurrenceStatus } from '../../core/i18n/pm-status-labels';
import { ActivitySpecialty, SPECIALTY_LABELS } from '../../core/i18n/specialty-labels';
import { CurrentUserStore } from '../../core/identity/current-user-store';
import { canReach } from '../../core/identity/navigation';
import {
  AppPmOccurrence,
  AppPmScheduleFilterOptions,
  AppPmScheduleQuery,
  PmScheduleGateway,
} from '../../core/maintenance/pm-schedule-gateway';
import { ActiveFilters } from '../../ui/active-filters/active-filters';
import { ActiveFilterChip } from '../../ui/active-filters/active-filter-chips';
import { DataSheet } from '../../ui/data-sheet/data-sheet';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { Icon } from '../../ui/icon/icon';
import { JalaliDatetimeField } from '../../ui/jalali-datetime-field/jalali-datetime-field';
import { PageHeader } from '../../ui/page-header/page-header';
import { PmCalendar, PmCalendarFailure } from './pm-calendar';
import { PmScheduleTable } from './pm-schedule-table';

/** The two ways the page shows the schedule. */
export type PmScheduleView = 'calendar' | 'table';

/** The shared filters. `''` is «همه» — signal forms take no `null` initial value. */
interface PmScheduleFilterModel {
  readonly equipmentId: string;
  readonly activityId: string;
  readonly status: PmOccurrenceStatus | '';
  readonly performedById: string;
  readonly specialty: ActivitySpecialty | '';
}

const NO_FILTERS: PmScheduleFilterModel = {
  equipmentId: '',
  activityId: '',
  status: '',
  performedById: '',
  specialty: '',
};

const NO_FILTER_OPTIONS: AppPmScheduleFilterOptions = {
  equipment: [],
  activities: [],
  performers: [],
};

/** The statuses in the order the vocabulary lists them, with their Persian words. */
const STATUS_OPTIONS = (Object.keys(PM_STATUS_LABELS) as PmOccurrenceStatus[]).map((status) => ({
  value: status,
  label: PM_STATUS_LABELS[status],
}));

/** «برق» and «مکانیک», in the vocabulary's order. */
const SPECIALTY_OPTIONS = (Object.keys(SPECIALTY_LABELS) as ActivitySpecialty[]).map(
  (specialty) => ({ value: specialty, label: SPECIALTY_LABELS[specialty] }),
);

const RETIRED_MARK = '(کنار گذاشته شده)';

type FilterKey = keyof PmScheduleFilterModel;

/** The filters' column words, in the order their chips read. */
const FILTER_LABELS: Readonly<Record<FilterKey, string>> = {
  equipmentId: 'تجهیز',
  specialty: 'تخصص',
  activityId: 'فعالیت',
  status: 'وضعیت',
  performedById: 'انجام دهنده',
};

/** A Jalali month as the table's range: its first and its last day. */
const monthRange = (month: JalaliMonth): DateRangeFormModel => ({
  from: month.firstDay,
  to: month.lastDay,
});

const orNull = (value: string): string | null => (value === '' ? null : value);

const failureOf = (error: unknown): PmCalendarFailure | null => {
  if (error === undefined || error === null) {
    return null;
  }
  return error instanceof HttpErrorResponse && error.status === 403 ? 'forbidden' : 'error';
};

/**
 * `/pm-schedule/overview` — «برنامه PM» under «فنی» (issue #90; «گزارش PM» before it). Every PM
 * occurrence in a stretch of time, past or future, as a Jalali month **calendar** (the default) or a
 * **table**, chosen with a single-selection toggle at the top. Read-only.
 *
 * - **The filters are shared** and sit above both views: equipment, activity, status, performer and
 *   specialty (issue #108), each «همه» by default, sent to the API as query parameters — the page
 *   never filters rows itself.
 * - **The table has a due-date range**, «از تاریخ» / «تا تاریخ», both required and the start not
 *   after the end; it opens on the current Jalali month, «ماه جاری» puts it back, and any valid change
 *   reloads at once. An invalid range shows its error inline and asks nothing.
 * - **The calendar has a month of its own**, independent of that range, and asks for the rows whose
 *   `calendarDate` falls within it.
 *
 * View, filters, range and month all live here, so switching views loses none of them; only the view
 * on screen is read, and it is read again on the way back.
 *
 * Issue #112: «تجهیز» and «تخصص» stay in the bar; «فعالیت», «وضعیت» and «انجام دهنده» sit behind
 * «فیلترهای بیشتر» (a disclosure, in the DOM only while open). Every filter set — hidden ones too —
 * is a removable chip under the bar, with «پاک کردن همه». A one-line note under it says which date
 * the visible view goes by. The table's rows link the equipment to its folder (for a role that may
 * open one) and open their details from «جزئیات»; a late chip on the calendar names its due date. Each read is an `rxResource` whose params
 * are the current choice, so its progress bar shows in the very render that changes the choice and
 * goes once the rows — possibly none — are in.
 */
@Component({
  selector: 'app-pm-overview-page',
  imports: [
    ActiveFilters,
    DataSheet,
    ErrorBanner,
    FormField,
    Icon,
    JalaliDatetimeField,
    MatButton,
    MatButtonToggle,
    MatButtonToggleGroup,
    MatFormField,
    MatIcon,
    MatLabel,
    MatOption,
    MatSelect,
    PageHeader,
    PmCalendar,
    PmScheduleTable,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack">
      <app-page-header
        heading="برنامه PM"
        description="موعدهای برنامهٔ PM تجهیزات، گذشته و آینده، در تقویم یا جدول"
      >
        <mat-button-toggle-group
          pageHeaderActions
          aria-label="نمای برنامه PM"
          hideSingleSelectionIndicator
          [value]="view()"
          (change)="view.set($event.value)"
        >
          <mat-button-toggle value="calendar">
            <mat-icon appIcon="calendar-days" />تقویم PM
          </mat-button-toggle>
          <mat-button-toggle value="table">
            <mat-icon appIcon="spreadsheet" />جدول PM
          </mat-button-toggle>
        </mat-button-toggle-group>
      </app-page-header>

      <div class="filter-bar pm-filters" role="group" aria-label="فیلترهای برنامه PM">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>تجهیز</mat-label>
          <mat-select [formField]="filtersForm.equipmentId">
            <mat-option value="">همه</mat-option>
            @for (equipment of filterOptions().equipment; track equipment.id) {
              <mat-option [value]="equipment.id">{{ equipmentLabel(equipment) }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>تخصص</mat-label>
          <mat-select [formField]="filtersForm.specialty">
            <mat-option value="">همه</mat-option>
            @for (specialty of specialtyOptions; track specialty.value) {
              <mat-option [value]="specialty.value">{{ specialty.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <button
          matButton
          type="button"
          class="pm-filters__more-toggle"
          aria-controls="pm-more-filters"
          [attr.aria-expanded]="moreFilters()"
          (click)="moreFilters.set(!moreFilters())"
        >
          <mat-icon appIcon="filter" />فیلترهای بیشتر
        </button>

        <div id="pm-more-filters" class="pm-filters__more">
          @if (moreFilters()) {
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>فعالیت</mat-label>
              <mat-select [formField]="filtersForm.activityId">
                <mat-option value="">همه</mat-option>
                @for (activity of filterOptions().activities; track activity.id) {
                  <mat-option [value]="activity.id">{{ activity.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>وضعیت</mat-label>
              <mat-select [formField]="filtersForm.status">
                <mat-option value="">همه</mat-option>
                @for (status of statusOptions; track status.value) {
                  <mat-option [value]="status.value">{{ status.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>انجام دهنده</mat-label>
              <mat-select [formField]="filtersForm.performedById">
                <mat-option value="">همه</mat-option>
                @for (performer of filterOptions().performers; track performer.id) {
                  <mat-option [value]="performer.id">{{ performer.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          }
        </div>
      </div>

      <app-active-filters
        [chips]="chips()"
        (removed)="removeFilter($event)"
        (clearedAll)="clearFilters()"
      />

      @if (view() === 'calendar') {
        <p class="pm-date-note">
          <mat-icon appIcon="info" />
          <span
            >در تقویم، هر مورد در روز موعدش است؛ موردی که با تاخیر انجام شده در روز انجامش آمده و
            موعدش روی آن نوشته شده است.</span
          >
        </p>
      } @else {
        <p class="pm-date-note">
          <mat-icon appIcon="info" />
          <span
            >جدول بر اساس تاریخ موعد است؛ زمان انجام هر مورد در ستون «زمان انجام» آمده است.</span
          >
        </p>
      }

      @if (view() === 'calendar') {
        <app-pm-calendar
          [(month)]="calendarMonth"
          [occurrences]="calendarOccurrences()"
          [loading]="calendarResource.isLoading()"
          [failure]="calendarFailure()"
          (retry)="calendarResource.reload()"
        />
      } @else {
        <app-data-sheet
          heading="موعدهای برنامهٔ PM"
          [count]="
            tableResource.hasValue() && !tableResource.isLoading() ? tableRows().length : null
          "
          [loading]="tableResource.isLoading()"
          loadingLabel="در حال بارگذاری جدول PM"
        >
          <form
            sheetFilters
            novalidate
            class="pm-range"
            aria-label="بازهٔ موعد"
            (submit)="$event.preventDefault()"
          >
            <app-jalali-datetime-field
              [field]="rangeForm.from"
              dateLabel="از تاریخ"
              boundName="از تاریخ"
              [withTime]="false"
            />
            <app-jalali-datetime-field
              [field]="rangeForm.to"
              dateLabel="تا تاریخ"
              boundName="تا تاریخ"
              [withTime]="false"
            />
            <button matButton="outlined" type="button" (click)="showCurrentMonth()">
              <mat-icon appIcon="calendar" />ماه جاری
            </button>
          </form>

          @if (tableFailure() === 'forbidden') {
            <app-error-banner message="شما دسترسی لازم برای مشاهده این بخش را ندارید." />
          } @else if (tableFailure() === 'error') {
            <app-error-banner
              message="برنامه PM بارگذاری نشد."
              retryLabel="تلاش دوباره"
              (retry)="tableResource.reload()"
            />
          } @else if (!rangeForm().valid()) {
            <p class="no-data">برای دیدن موعدها، بازهٔ درستی انتخاب کنید.</p>
          } @else if (tableResource.hasValue() && !tableResource.isLoading()) {
            <app-pm-schedule-table [occurrences]="tableRows()" [canOpenFolder]="canOpenFolder()" />
          }
        </app-data-sheet>
      }
    </div>
  `,
  styleUrl: './pm-overview-page.scss',
})
export class PmOverviewPage {
  private readonly gateway = inject(PmScheduleGateway);
  private readonly currentUser = inject(CurrentUserStore);

  /** Whether the table may link each equipment to its folder — the PM Inspector may not. */
  protected readonly canOpenFolder = computed(() => canReach('pm-plans', this.currentUser.role()));

  /** «فیلترهای بیشتر»: closed as the page opens; its filters still apply, and show as chips. */
  protected readonly moreFilters = signal(false);

  protected readonly view = signal<PmScheduleView>('calendar');
  /** Opens on Tehran's current month — the API's today, not the browser's. */
  protected readonly calendarMonth = signal(JalaliMonth.containing(tehranToday()));

  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly specialtyOptions = SPECIALTY_OPTIONS;

  private readonly filtersModel = signal<PmScheduleFilterModel>(NO_FILTERS);
  protected readonly filtersForm = form(this.filtersModel);

  private readonly rangeModel = signal<DateRangeFormModel>(
    monthRange(JalaliMonth.containing(tehranToday())),
  );
  protected readonly rangeForm = form(this.rangeModel, (path) => {
    required(path.from, { message: 'از تاریخ را انتخاب کنید.' });
    required(path.to, { message: 'تا تاریخ را انتخاب کنید.' });
    apply(path, dateRangeSchema);
  });

  private readonly filtersResource = rxResource({
    stream: () => this.gateway.filterOptions(),
  });

  protected readonly filterOptions = computed(() =>
    this.filtersResource.hasValue() ? this.filtersResource.value() : NO_FILTER_OPTIONS,
  );

  private readonly filters = computed(() => {
    const filters = this.filtersModel();
    return {
      equipmentId: orNull(filters.equipmentId),
      activityId: orNull(filters.activityId),
      status: filters.status === '' ? null : filters.status,
      performedById: orNull(filters.performedById),
      specialty: filters.specialty === '' ? null : filters.specialty,
    };
  });

  protected readonly calendarResource = rxResource({
    params: (): AppPmScheduleQuery | undefined => {
      if (this.view() !== 'calendar') {
        return undefined;
      }
      const month = this.calendarMonth();
      return {
        from: toIsoCalendarDate(month.firstDay),
        to: toIsoCalendarDate(month.lastDay),
        ...this.filters(),
      };
    },
    stream: ({ params }) => this.gateway.calendar(params),
  });

  protected readonly tableResource = rxResource({
    params: (): AppPmScheduleQuery | undefined => {
      const { from, to } = this.rangeModel();
      // An unset or back-to-front range asks nothing: its error shows on the field instead.
      if (this.view() !== 'table' || !this.rangeForm().valid() || from === null || to === null) {
        return undefined;
      }
      return { from: toIsoCalendarDate(from), to: toIsoCalendarDate(to), ...this.filters() };
    },
    stream: ({ params }) => this.gateway.overview(params),
  });

  protected readonly calendarOccurrences = computed<readonly AppPmOccurrence[]>(() =>
    this.calendarResource.hasValue() && !this.calendarResource.isLoading()
      ? this.calendarResource.value()
      : [],
  );

  protected readonly tableRows = computed<readonly AppPmOccurrence[]>(() =>
    this.tableResource.hasValue() ? this.tableResource.value() : [],
  );

  protected readonly calendarFailure = computed(() => failureOf(this.calendarResource.error()));
  protected readonly tableFailure = computed(() => failureOf(this.tableResource.error()));

  constructor() {
    // A bound is picked in a popup, so its field is not "touched" until focus leaves it — and a
    // back-to-front range would sit there unexplained. Any change to the range shows its errors.
    effect(() => {
      this.rangeModel();
      untracked(() => {
        this.rangeForm.from().markAsTouched();
        this.rangeForm.to().markAsTouched();
      });
    });
  }

  protected equipmentLabel(equipment: { name: string; retired: boolean }): string {
    return equipment.retired ? `${equipment.name} ${RETIRED_MARK}` : equipment.name;
  }

  protected clearFilters(): void {
    this.filtersModel.set(NO_FILTERS);
  }

  /** One chip per filter set, in the bar's order, worded as its select shows the value. */
  protected readonly chips = computed<ActiveFilterChip[]>(() => {
    const filters = this.filtersModel();
    const options = this.filterOptions();
    const valueLabel: Record<FilterKey, (value: string) => string> = {
      equipmentId: (id) => {
        const equipment = options.equipment.find((candidate) => candidate.id === id);
        return equipment ? this.equipmentLabel(equipment) : id;
      },
      specialty: (value) => SPECIALTY_LABELS[value as ActivitySpecialty] ?? value,
      activityId: (id) => options.activities.find((candidate) => candidate.id === id)?.name ?? id,
      status: (value) => PM_STATUS_LABELS[value as PmOccurrenceStatus] ?? value,
      performedById: (id) =>
        options.performers.find((candidate) => candidate.id === id)?.name ?? id,
    };
    return (Object.keys(FILTER_LABELS) as FilterKey[])
      .filter((key) => filters[key] !== '')
      .map((key) => {
        const column = FILTER_LABELS[key];
        const value = valueLabel[key](filters[key]);
        return {
          id: key,
          filterKey: key,
          filterValue: filters[key],
          column,
          value,
          removeLabel: `حذف فیلتر ${column}: ${value}`,
        };
      });
  });

  protected removeFilter(chip: ActiveFilterChip): void {
    const key = chip.filterKey as FilterKey;
    this.filtersModel.update((filters) => ({ ...filters, [key]: '' }));
  }

  protected showCurrentMonth(): void {
    this.rangeModel.set(monthRange(JalaliMonth.containing(tehranToday())));
  }
}
