import { formatJalaliCalendarDate } from '../../core/date/calendar-date';
import { formatJalaliDateTime } from '../../core/date/jalali-datetime';
import { formatPersianNumber, toLatinDigits } from '../../core/i18n/persian-numerals';
import { NO_DELAY } from '../../core/i18n/pm-delay-labels';
import { PM_STATUS_LABELS, PmOccurrenceStatus } from '../../core/i18n/pm-status-labels';
import { matchesSearch } from '../../core/i18n/search-normalizer';
import { AppPmDashboardOccurrence } from '../../core/maintenance/pm-dashboard-gateway';
import { trendRangeLabel } from './pm-dashboard-figures';

/**
 * What a click elsewhere on the dashboard narrows the follow-up table to: a card's count, a trend
 * point's occurrences, or one equipment's overdue work from «بیشترین عقب افتادگی». One at a time;
 * it combines with the table's own status filter and search.
 */
export type PmFollowUpFocus =
  | { readonly kind: 'due-today' | 'overdue' | 'done-today' | 'missed' }
  | { readonly kind: 'period'; readonly from: string; readonly to: string }
  | {
      readonly kind: 'equipment-overdue';
      readonly equipmentId: string;
      readonly equipmentName: string;
    };

export interface PmFollowUpFilter {
  readonly focus: PmFollowUpFocus | null;
  /** `''` is «همه». */
  readonly status: PmOccurrenceStatus | '';
  readonly search: string;
}

export const NO_FOLLOW_UP_FILTER: PmFollowUpFilter = { focus: null, status: '', search: '' };

/**
 * Whether an occurrence is one the focus counts. The cards' rules are the API's: «سررسید امروز» and
 * «عقب افتاده» count only work that can still be recorded (an active item of equipment in service),
 * which is exactly what `recordable` says — so the rows a card shows add up to its number.
 */
const matchesFocus = (occurrence: AppPmDashboardOccurrence, focus: PmFollowUpFocus): boolean => {
  switch (focus.kind) {
    case 'due-today':
      return occurrence.status === 'due' && occurrence.recordable;
    case 'overdue':
      return occurrence.status === 'overdue' && occurrence.recordable;
    case 'done-today':
      return occurrence.doneToday;
    case 'missed':
      return occurrence.status === 'missed';
    case 'period':
      return occurrence.dueDate >= focus.from && occurrence.dueDate <= focus.to;
    case 'equipment-overdue':
      return (
        occurrence.status === 'overdue' &&
        occurrence.recordable &&
        occurrence.equipmentId === focus.equipmentId
      );
  }
};

/** The rows the filter lets through, in the order given. */
export const followUpRows = (
  occurrences: readonly AppPmDashboardOccurrence[],
  filter: PmFollowUpFilter,
): readonly AppPmDashboardOccurrence[] =>
  occurrences.filter(
    (occurrence) =>
      (filter.focus === null || matchesFocus(occurrence, filter.focus)) &&
      (filter.status === '' || occurrence.status === filter.status) &&
      matchesSearch(`${occurrence.equipmentName} ${occurrence.activityName}`, filter.search),
  );

/** The focus as its removable chip names it. */
export const focusLabel = (focus: PmFollowUpFocus): string => {
  switch (focus.kind) {
    case 'due-today':
      return 'سررسید امروز';
    case 'overdue':
      return 'عقب افتاده';
    case 'done-today':
      return 'انجام شده امروز';
    case 'missed':
      return 'موعدهای ازدست رفته';
    case 'period':
      return `موعدهای ${trendRangeLabel(focus)}`;
    case 'equipment-overdue':
      return `کارهای عقب افتاده ${focus.equipmentName}`;
  }
};

/** How many days behind an occurrence is or was: late by `daysLate`, overdue by `daysOverdue`. */
const delayDays = (occurrence: AppPmDashboardOccurrence): number | null => {
  if (occurrence.status === 'late') {
    return occurrence.daysLate;
  }
  return occurrence.status === 'overdue' ? occurrence.daysOverdue : null;
};

/** «مقدار تاخیر»: «۲ روز», or a hyphen when the work is not behind. */
export const followUpDelayLabel = (occurrence: AppPmDashboardOccurrence): string => {
  const days = delayDays(occurrence);
  return days === null ? NO_DELAY : `${formatPersianNumber(days)} روز`;
};

export type PmFollowUpSortColumn = 'equipment' | 'activity' | 'dueDate' | 'status' | 'delay';

/** `matSort`'s state: `''` for either means the API's own order. */
export interface PmFollowUpSort {
  readonly column: PmFollowUpSortColumn | '';
  readonly direction: 'asc' | 'desc' | '';
}

/** Most urgent first: what to do now, then what was lost, then what was done, then what is ahead. */
const STATUS_URGENCY: readonly PmOccurrenceStatus[] = [
  'overdue',
  'due',
  'missed',
  'late',
  'on_time',
  'upcoming',
];

const persianCollator = new Intl.Collator('fa');

const compareBy: Record<
  PmFollowUpSortColumn,
  (a: AppPmDashboardOccurrence, b: AppPmDashboardOccurrence) => number
> = {
  equipment: (a, b) => persianCollator.compare(a.equipmentName, b.equipmentName),
  activity: (a, b) => persianCollator.compare(a.activityName, b.activityName),
  dueDate: (a, b) => a.dueDate.localeCompare(b.dueDate),
  status: (a, b) => STATUS_URGENCY.indexOf(a.status) - STATUS_URGENCY.indexOf(b.status),
  delay: (a, b) => (delayDays(a) ?? -1) - (delayDays(b) ?? -1),
};

/** The rows in the chosen order; ties keep the API's order either way. */
export const sortFollowUpRows = (
  rows: readonly AppPmDashboardOccurrence[],
  sort: PmFollowUpSort,
): readonly AppPmDashboardOccurrence[] => {
  if (sort.column === '' || sort.direction === '') {
    return rows;
  }
  const compare = compareBy[sort.column];
  const sign = sort.direction === 'asc' ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => sign * compare(a.row, b.row) || a.index - b.index)
    .map(({ row }) => row);
};

const CSV_HEADER = [
  'تجهیز',
  'فعالیت',
  'تاریخ سررسید',
  'وضعیت',
  'مقدار تاخیر (روز)',
  'زمان انجام',
  'انجام دهنده',
  'توضیحات',
];

/**
 * A cell Excel (and other spreadsheets) would evaluate as a formula — one starting `=`, `+`, `-`,
 * `@`, a tab or a carriage return. Names and notes are typed by people, so one could carry a formula
 * that runs, or reaches out, in whoever opens the export.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

/** A value as one CSV cell: a would-be formula turned into text with a leading `'`, then quoted if needed. */
const csvField = (raw: string): string => {
  const value = FORMULA_START.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
};

/** A date or a day count a spreadsheet can sort and sum: Latin digits. */
const latinJalaliDate = (isoDate: string): string =>
  toLatinDigits(formatJalaliCalendarDate(isoDate));

/** In the viewer's own time zone, like every instant the app shows. */
const latinJalaliInstant = (instant: string | null): string => {
  const date = instant === null ? null : new Date(instant);
  return date === null || Number.isNaN(date.getTime())
    ? ''
    : toLatinDigits(formatJalaliDateTime(date));
};

/**
 * The rows as a CSV file Excel opens directly: UTF-8 with a byte-order mark (without it Excel reads
 * Persian as Latin-1), CRLF line ends, quoted where a value needs it. Dates are Jalali and numbers
 * Latin, so the sheet can sort and sum them.
 */
export const followUpCsv = (rows: readonly AppPmDashboardOccurrence[]): string => {
  const lines = rows.map((row) => {
    const delay = delayDays(row);
    return [
      row.equipmentName,
      row.activityName,
      latinJalaliDate(row.dueDate),
      PM_STATUS_LABELS[row.status],
      delay === null ? '' : String(delay),
      latinJalaliInstant(row.performedAt),
      row.performedByName ?? '',
      row.notes ?? '',
    ];
  });
  return `\uFEFF${[CSV_HEADER, ...lines].map((line) => line.map(csvField).join(',')).join('\r\n')}`;
};
