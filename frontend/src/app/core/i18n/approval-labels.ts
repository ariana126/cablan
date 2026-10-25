import { BomApprovalStatus } from '../../api/model';

/** Where a daily BOM's review stands: waiting for Management or a System Admin, or approved or
 * rejected by one of them. */
export type AppApprovalStatus = BomApprovalStatus;

/**
 * How «تایید/رد کننده» reads while nobody has reviewed the daily BOM. A plain hyphen, not the em
 * dash the app uses for other missing values: every surface that shows the reviewer — the report
 * list, the dashboard, the Excel export, the audit log — names a missing one this way, and they
 * have to read alike.
 */
export const NO_REVIEWER = '-';

/** How «توضیحات مدیریت» reads when the review left none — the same hyphen, as the export writes it. */
export const NO_MANAGEMENT_NOTE = '-';

/**
 * The reviewer filters' value for a daily BOM nobody has reviewed yet — Excel's "(Blanks)" — and
 * the words its checkbox reads. Offered beside the reviewers' names wherever a pending daily BOM
 * exists, so that ticking every option really does mean "no filter": without it, a pending row
 * matches none of the options, and "every reviewer" would silently drop it.
 */
export const NO_REVIEWER_FILTER_VALUE = '';
export const NO_REVIEWER_FILTER_LABEL = 'بدون تایید/رد کننده';

const APPROVAL_STATUS_LABELS: Readonly<Record<AppApprovalStatus, string>> = {
  pending: 'در انتظار تایید',
  approved: 'تایید',
  rejected: 'عدم تایید',
};

/** «در انتظار تایید», «تایید» or «عدم تایید». */
export function approvalStatusLabel(status: AppApprovalStatus): string {
  return APPROVAL_STATUS_LABELS[status];
}

/** The reviewer's display name, or `NO_REVIEWER` when there is none. */
export function reviewerLabel(reviewedBy: string | null): string {
  return reviewedBy === null || reviewedBy === '' ? NO_REVIEWER : reviewedBy;
}
