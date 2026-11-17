import { Role } from '@framework/domain';

/**
 * Who manages production QC (issue #119) — the QC activity catalog,
 * assignments to equipment, and reading every QC record: management and the
 * system admin.
 */
export const QC_MANAGER_ROLES: readonly Role[] = [
  Role.SystemAdmin,
  Role.Management,
];

/**
 * Who records that a QC activity was done, and reads the inspection view:
 * the managers and the QC inspector.
 */
export const QC_RECORDER_ROLES: readonly Role[] = [
  ...QC_MANAGER_ROLES,
  Role.QcInspector,
];
