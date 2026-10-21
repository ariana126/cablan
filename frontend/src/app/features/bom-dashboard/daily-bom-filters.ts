import { AppBomDashboardDailyBom } from '../../core/bom-dashboard/bom-dashboard-gateway';
import {
  AppApprovalStatus,
  approvalStatusLabel,
  NO_APPROVER_FILTER_LABEL,
  NO_APPROVER_FILTER_VALUE,
} from '../../core/i18n/approval-labels';
import { CheckboxFilterDialogOption } from '../../ui/checkbox-filter-dialog/checkbox-filter-dialog';

/** The approver filter's value for a daily BOM nobody has approved — Excel's "(Blanks)". */
export const NO_APPROVER_VALUE = NO_APPROVER_FILTER_VALUE;

/**
 * The per-product panel's two Excel-style filters. For each, `undefined` means "no filter" and `[]`
 * means "match nothing", the convention every checkbox filter in the app follows.
 */
export interface DailyBomFilters {
  readonly approvalStatuses?: readonly string[];
  readonly approvers?: readonly string[];
}

const STATUS_ORDER: readonly AppApprovalStatus[] = ['approved', 'unapproved'];

/**
 * The panel's daily BOMs a visitor asked to see, in the order they arrived (highest score first).
 * Client-side, over the list already loaded for the product: the endpoint has no filter of its own,
 * and the list is one product's analyses over one range.
 */
export function filterDailyBoms(
  boms: readonly AppBomDashboardDailyBom[],
  filters: DailyBomFilters,
): AppBomDashboardDailyBom[] {
  return boms.filter(
    (bom) =>
      (filters.approvalStatuses?.includes(bom.approvalStatus) ?? true) &&
      (filters.approvers?.includes(bom.approvedBy ?? NO_APPROVER_VALUE) ?? true),
  );
}

/** «تایید شده» and/or «تایید نشده» — whichever the list holds. */
export function approvalStatusOptions(
  boms: readonly AppBomDashboardDailyBom[],
): CheckboxFilterDialogOption[] {
  const present = new Set(boms.map((bom) => bom.approvalStatus));
  return STATUS_ORDER.filter((status) => present.has(status)).map((status) => ({
    value: status,
    label: approvalStatusLabel(status),
  }));
}

/** Each approver once, alphabetically, then «بدون تایید کننده» when any daily BOM has none. */
export function approverOptions(
  boms: readonly AppBomDashboardDailyBom[],
): CheckboxFilterDialogOption[] {
  const names = [...new Set(boms.flatMap((bom) => (bom.approvedBy ? [bom.approvedBy] : [])))].sort(
    (a, b) => a.localeCompare(b, 'fa'),
  );
  const options = names.map((name) => ({ value: name, label: name }));
  return boms.some((bom) => !bom.approvedBy)
    ? [...options, { value: NO_APPROVER_VALUE, label: NO_APPROVER_FILTER_LABEL }]
    : options;
}
