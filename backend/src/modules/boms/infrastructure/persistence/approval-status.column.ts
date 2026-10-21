import { ApprovalStatus } from '@boms/domain/value/approval-status';

const KNOWN_STATUSES: readonly string[] = Object.values(ApprovalStatus);

/**
 * Reads `bom.approval_status`, a plain `String` column (like
 * `audit_log_entry.action`), back as the domain's `ApprovalStatus`. The
 * column's values are the enum's values by design; anything else means the
 * row was written outside the application, which is worth failing loudly on.
 */
export function toApprovalStatus(column: string): ApprovalStatus {
  if (!KNOWN_STATUSES.includes(column)) {
    throw new Error(`Unknown approval status stored on a daily BOM: ${column}`);
  }
  return column as ApprovalStatus;
}
