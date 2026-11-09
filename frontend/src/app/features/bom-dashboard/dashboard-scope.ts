import { AppBomDashboardRange } from '../../core/bom-dashboard/bom-dashboard-gateway';
import { formatJalaliDateTime } from '../../core/date/jalali-datetime';
import {
  AppApprovalStatus,
  approvalStatusLabel,
  NO_REVIEWER_FILTER_LABEL,
  NO_REVIEWER_FILTER_VALUE,
} from '../../core/i18n/approval-labels';
import { DashboardApprovalFilters } from './approval-filters';

/** One line of the dashboard's scope summary: what is narrowed, and to what. */
export interface ScopeLine {
  readonly label: string;
  readonly value: string;
}

export interface DashboardScopeInput {
  readonly range: AppBomDashboardRange;
  readonly approvalFilters: DashboardApprovalFilters;
  /** Whether the visitor applied «وضعیت تایید» themselves — until then «در انتظار تایید» is the
   * page's default, and the summary says so. */
  readonly statusesChosen: boolean;
  readonly numberSearch: { readonly orderNumber: string; readonly trackingNumber: string };
}

const LIST_SEPARATOR = '، ';
const NONE = 'هیچ‌کدام';

function jalali(iso: string): string {
  return formatJalaliDateTime(new Date(iso));
}

function rangeText({ from, to }: AppBomDashboardRange): string {
  if (from && to) {
    return `از ${jalali(from)} تا ${jalali(to)}`;
  }
  if (from) {
    return `از ${jalali(from)}`;
  }
  if (to) {
    return `تا ${jalali(to)}`;
  }
  return 'همهٔ تاریخ‌ها';
}

function statusText(
  statuses: readonly AppApprovalStatus[] | undefined,
  statusesChosen: boolean,
): string {
  if (statuses === undefined) {
    return 'همه';
  }
  if (statuses.length === 0) {
    return NONE;
  }
  if (!statusesChosen && statuses.length === 1 && statuses[0] === 'pending') {
    return 'فقط در انتظار تایید (پیش‌فرض)';
  }
  return statuses.map(approvalStatusLabel).join(LIST_SEPARATOR);
}

function reviewerText(reviewers: readonly string[]): string {
  if (reviewers.length === 0) {
    return NONE;
  }
  return reviewers
    .map((name) => (name === NO_REVIEWER_FILTER_VALUE ? NO_REVIEWER_FILTER_LABEL : name))
    .join(LIST_SEPARATOR);
}

/**
 * What the dashboard is showing, line by line (issue #113): the date range and the approval status
 * always — the latter calling out the page's «در انتظار تایید» default — then the reviewer filter and
 * the number searches when set. Every value in the visitor's words; derived from the filters alone.
 */
export function dashboardScope({
  range,
  approvalFilters,
  statusesChosen,
  numberSearch,
}: DashboardScopeInput): ScopeLine[] {
  const lines: ScopeLine[] = [
    { label: 'بازهٔ زمانی', value: rangeText(range) },
    {
      label: 'وضعیت تایید',
      value: statusText(approvalFilters.approvalStatuses, statusesChosen),
    },
  ];
  if (approvalFilters.reviewers !== undefined) {
    lines.push({ label: 'تایید/رد کننده', value: reviewerText(approvalFilters.reviewers) });
  }
  const orderNumber = numberSearch.orderNumber.trim();
  if (orderNumber) {
    lines.push({ label: 'شماره سفارش', value: `شامل «${orderNumber}»` });
  }
  const trackingNumber = numberSearch.trackingNumber.trim();
  if (trackingNumber) {
    lines.push({ label: 'شماره ردیابی', value: `شامل «${trackingNumber}»` });
  }
  return lines;
}

/** What a card's write did, and to which analysis. */
export interface DailyBomChange {
  readonly orderNumber: string;
  readonly trackingNumber: string;
  readonly kind: 'approved' | 'rejected' | 'weight-edited' | 'description-edited';
}

/** The status each write leaves the analysis in — a weight correction sends a reviewed one back to
 * pending (the API's rule); a description edit is not stated, since the page does not know it. */
const NEW_STATUS: Readonly<Record<DailyBomChange['kind'], AppApprovalStatus | undefined>> = {
  approved: 'approved',
  rejected: 'rejected',
  'weight-edited': 'pending',
  'description-edited': undefined,
};

/**
 * The snackbar after a card's write: names the analysis and its new status, and — when the active
 * «وضعیت تایید» filter no longer lets that status through — that it has left the list.
 */
export function reviewFeedback(change: DailyBomChange, filters: DashboardApprovalFilters): string {
  const analysis = `آنالیز سفارش ${change.orderNumber} (شماره ردیابی ${change.trackingNumber})`;
  let sentence: string;
  switch (change.kind) {
    case 'approved':
      sentence = `${analysis} تایید شد.`;
      break;
    case 'rejected':
      sentence = `${analysis} عدم تایید شد.`;
      break;
    case 'weight-edited':
      sentence = `وزن ${analysis} ذخیره شد؛ وضعیت آن «در انتظار تایید» است.`;
      break;
    case 'description-edited':
      sentence = `توضیحات ${analysis} ذخیره شد.`;
      break;
  }
  const status = NEW_STATUS[change.kind];
  const statuses = filters.approvalStatuses;
  const leaves = status !== undefined && statuses !== undefined && !statuses.includes(status);
  return leaves ? `${sentence} با فیلتر فعلی «وضعیت تایید» دیگر در فهرست نیست.` : sentence;
}
