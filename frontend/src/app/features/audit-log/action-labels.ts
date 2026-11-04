import { AppAuditAction, AppRecordType } from '../../core/audit-log/audit-log-gateway';

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
  Deactivated: 'غیرفعال‌سازی',
  Reactivated: 'فعال سازی دوباره',
};

/** The entries whose action reads better named for its record — the System Admin's maintenance
 * deletions and reactivation (issue #110). */
const RECORD_ACTION_LABELS: Readonly<
  Partial<Record<AppRecordType, Partial<Record<AppAuditAction, string>>>>
> = {
  MaintenanceExecution: { Deleted: 'حذف سابقه انجام' },
  PmPlanItem: { Deleted: 'حذف ردیف غیرفعال برنامه' },
  Equipment: { Deleted: 'حذف تجهیز', Reactivated: 'فعال سازی دوباره تجهیز' },
};

/** What the log's «نوع رویداد» column says for one entry. */
export function actionLabel(recordType: AppRecordType, action: AppAuditAction): string {
  return RECORD_ACTION_LABELS[recordType]?.[action] ?? ACTION_LABELS[action];
}
