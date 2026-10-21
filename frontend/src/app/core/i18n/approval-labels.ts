import { BomApprovalStatus } from '../../api/model';

/** Whether a daily BOM has been approved by Management or a System Admin. */
export type AppApprovalStatus = BomApprovalStatus;

/**
 * How «تایید کننده» reads when nobody has approved the daily BOM. A plain hyphen, not the em dash
 * the app uses for other missing values: every surface that shows the approver — the report list,
 * the dashboard, the Excel export, the audit log — names a missing one this way, and they have to
 * read alike.
 */
export const NO_APPROVER = '-';

/**
 * The approver filters' value for a daily BOM nobody has approved — Excel's "(Blanks)" — and the
 * words its checkbox reads. Offered beside the approvers' names wherever an unapproved daily BOM
 * exists, so that ticking every option really does mean "no filter": without it, an unapproved
 * row matches none of the options, and "every approver" would silently drop it.
 */
export const NO_APPROVER_FILTER_VALUE = '';
export const NO_APPROVER_FILTER_LABEL = 'بدون تایید کننده';

const APPROVAL_STATUS_LABELS: Readonly<Record<AppApprovalStatus, string>> = {
  approved: 'تایید شده',
  unapproved: 'تایید نشده',
};

/** «تایید شده» or «تایید نشده». */
export function approvalStatusLabel(status: AppApprovalStatus): string {
  return APPROVAL_STATUS_LABELS[status];
}

/** The approver's display name, or `NO_APPROVER` when there is none. */
export function approverLabel(approvedBy: string | null): string {
  return approvedBy === null || approvedBy === '' ? NO_APPROVER : approvedBy;
}
