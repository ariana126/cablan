import { AppAuditAction } from '../../core/audit-log/audit-log-gateway';

/** The Persian label shown for each kind of event the audit log records — the dashboard's own
 * button words for a daily BOM's approval and its revocation. */
export const ACTION_LABELS: Readonly<Record<AppAuditAction, string>> = {
  Registered: 'ثبت',
  Edited: 'ویرایش',
  Deleted: 'حذف',
  Approved: 'تایید',
  ApprovalRevoked: 'لغو تایید',
};
