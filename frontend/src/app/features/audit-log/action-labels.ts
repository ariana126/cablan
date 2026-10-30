import { AppAuditAction } from '../../core/audit-log/audit-log-gateway';

/** The Persian label shown for each kind of event the audit log records — for a daily BOM's review,
 * the dashboard's own words for it. `ApprovalRevoked` keeps its old label: no new entry carries it,
 * but the ones recorded before revoking went away still do. */
export const ACTION_LABELS: Readonly<Record<AppAuditAction, string>> = {
  Registered: 'ثبت',
  Edited: 'ویرایش',
  Deleted: 'حذف',
  Approved: 'تایید',
  Rejected: 'عدم تایید',
  ReturnedToPending: 'بازگشت به در انتظار تایید',
  ApprovalRevoked: 'لغو تایید',
  Imported: 'بارگذاری گروهی',
  Reverted: 'برگرداندن',
  Retired: 'کنار گذاشتن',
};
