import { AppRecordType } from '../../core/audit-log/audit-log-gateway';

/** The Persian label shown for each record type the audit log knows about. */
export const RECORD_TYPE_LABELS: Readonly<Record<AppRecordType, string>> = {
  User: 'کاربر',
  Product: 'محصول',
  Component: 'جز',
  Material: 'مواد اولیه',
  StandardBom: 'آنالیز استاندارد',
  Bom: 'آنالیز روزانه',
  MaterialImport: 'بارگذاری گروهی',
  Equipment: 'تجهیز',
  MaintenanceActivity: 'فعالیت تعمیرات و نگهداری',
  PmPlanItem: 'برنامه PM',
  MaintenanceExecution: 'انجام PM',
};
