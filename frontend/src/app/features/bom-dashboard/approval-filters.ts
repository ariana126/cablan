import { AppBomReportFilterOptions } from '../../core/boms/bom-report-gateway';
import {
  AppApprovalStatus,
  approvalStatusLabel,
  NO_REVIEWER_FILTER_LABEL,
  NO_REVIEWER_FILTER_VALUE,
} from '../../core/i18n/approval-labels';
import { CheckboxFilterDialogOption } from '../../ui/checkbox-filter-dialog/checkbox-filter-dialog';

/**
 * The dashboard's two Excel-style approval filters, sent with both of its requests. For each,
 * `undefined` means "no filter" and `[]` means "match nothing", the convention every checkbox
 * filter in the app follows; in `reviewers`, `NO_REVIEWER_FILTER_VALUE` stands for a daily BOM
 * nobody has reviewed yet.
 */
export interface DashboardApprovalFilters {
  readonly approvalStatuses?: readonly AppApprovalStatus[];
  readonly reviewers?: readonly string[];
}

/**
 * What the dashboard opens on: the daily BOMs still pending review, the work left to do. It is an
 * ordinary filter value — sent with both requests, shown ticked in the dialog, counted on the
 * button — and only the dashboard has it; the daily-BOM report opens unfiltered.
 */
export const DEFAULT_DASHBOARD_APPROVAL_FILTERS: DashboardApprovalFilters = {
  approvalStatuses: ['pending'],
};

/**
 * The filters once the visitor applies `reviewers`. A pending daily BOM has no reviewer, so named
 * reviewers under the untouched default «در انتظار تایید» could only ever match nothing: while the
 * visitor has not chosen statuses themselves (`statusesChosen`) and the reviewers leave out
 * «بدون تایید/رد کننده», the status filter is lifted — every status, the dialog all ticked. Statuses
 * the visitor chose are theirs and stay as they are.
 */
export function withReviewers(
  current: DashboardApprovalFilters,
  reviewers: readonly string[] | undefined,
  statusesChosen: boolean,
): DashboardApprovalFilters {
  const namesOnly = reviewers !== undefined && !reviewers.includes(NO_REVIEWER_FILTER_VALUE);
  return namesOnly && !statusesChosen
    ? { ...current, approvalStatuses: undefined, reviewers }
    : { ...current, reviewers };
}

/** A review's own order: waiting, then the two ways it can end. */
const STATUS_ORDER: readonly AppApprovalStatus[] = ['pending', 'approved', 'rejected'];

/** «در انتظار تایید», «تایید» and «عدم تایید» — whichever `filter-options` says occurs, in that
 * order. */
export function approvalStatusFilterOptions(
  options: Pick<AppBomReportFilterOptions, 'approvalStatuses'>,
): CheckboxFilterDialogOption[] {
  return STATUS_ORDER.filter((status) => options.approvalStatuses.includes(status)).map(
    (status) => ({ value: status, label: approvalStatusLabel(status) }),
  );
}

/**
 * Each reviewer `filter-options` lists, then «بدون تایید/رد کننده» while any daily BOM is pending —
 * the same rule as the report: `filter-options` names only real reviewers, and without the blank
 * value ticking every name would read as "no filter" and still let the pending ones through.
 */
export function reviewerFilterOptions(
  options: Pick<AppBomReportFilterOptions, 'approvalStatuses' | 'reviewers'>,
): CheckboxFilterDialogOption[] {
  const named = options.reviewers.map((name) => ({ value: name, label: name }));
  return options.approvalStatuses.includes('pending')
    ? [...named, { value: NO_REVIEWER_FILTER_VALUE, label: NO_REVIEWER_FILTER_LABEL }]
    : named;
}
