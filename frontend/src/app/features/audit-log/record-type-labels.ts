import { AppRecordType } from '../../core/audit-log/audit-log-gateway';

/** The Persian label shown for each of the six record types the audit log knows about. */
export const RECORD_TYPE_LABELS: Readonly<Record<AppRecordType, string>> = {
  User: 'کاربر',
  Product: 'محصول',
  Component: 'جز',
  Material: 'مواد اولیه',
  StandardBom: 'آنالیز استاندارد',
  Bom: 'آنالیز روزانه',
};
