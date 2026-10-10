import { Role } from '../../api/model';

/** The Persian label shown for each of the four roles the API knows about. */
export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  [Role.system_admin]: 'مدیر سیستم',
  [Role.management]: 'مدیریت',
  [Role.qc_inspector]: 'بازرس کنترل کیفیت',
  [Role.reporter]: 'گزارشگیر',
};
