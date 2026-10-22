import { AppBomReportFilterOptions } from '../../core/boms/bom-report-gateway';
import {
  AppApprovalStatus,
  approvalStatusLabel,
  NO_APPROVER_FILTER_LABEL,
  NO_APPROVER_FILTER_VALUE,
} from '../../core/i18n/approval-labels';
import { CheckboxFilterDialogOption } from '../../ui/checkbox-filter-dialog/checkbox-filter-dialog';

/**
 * The dashboard's two Excel-style approval filters, sent with both of its requests. For each,
 * `undefined` means "no filter" and `[]` means "match nothing", the convention every checkbox
 * filter in the app follows; in `approvers`, `NO_APPROVER_FILTER_VALUE` stands for a daily BOM
 * nobody has approved.
 */
export interface DashboardApprovalFilters {
  readonly approvalStatuses?: readonly AppApprovalStatus[];
  readonly approvers?: readonly string[];
}

const STATUS_ORDER: readonly AppApprovalStatus[] = ['approved', 'unapproved'];

/** «تایید شده» and/or «تایید نشده» — whichever `filter-options` says occurs, approved first. */
export function approvalStatusFilterOptions(
  options: Pick<AppBomReportFilterOptions, 'approvalStatuses'>,
): CheckboxFilterDialogOption[] {
  return STATUS_ORDER.filter((status) => options.approvalStatuses.includes(status)).map(
    (status) => ({ value: status, label: approvalStatusLabel(status) }),
  );
}

/**
 * Each approver `filter-options` lists, then «بدون تایید کننده» while any daily BOM is unapproved —
 * the same rule as the report: `filter-options` names only real approvers, and without the blank
 * value ticking every name would read as "no filter" and still let the unapproved ones through.
 */
export function approverFilterOptions(
  options: Pick<AppBomReportFilterOptions, 'approvalStatuses' | 'approvers'>,
): CheckboxFilterDialogOption[] {
  const named = options.approvers.map((name) => ({ value: name, label: name }));
  return options.approvalStatuses.includes('unapproved')
    ? [...named, { value: NO_APPROVER_FILTER_VALUE, label: NO_APPROVER_FILTER_LABEL }]
    : named;
}
