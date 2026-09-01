import { AppAuditAction } from '../../core/audit-log/audit-log-gateway';

/** The Persian label shown for each of the three kinds of mutating event the audit log records. */
export const ACTION_LABELS: Readonly<Record<AppAuditAction, string>> = {
  Registered: 'ثبت',
  Edited: 'ویرایش',
  Deleted: 'حذف',
};
