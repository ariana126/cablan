// The roles the system recognises. Shared across every feature module —
// RBAC (`@Roles()` / `RolesGuard`) lives in `framework/infrastructure/http/`
// precisely so no module has to duplicate this enum or import another
// module's copy of it.
export enum Role {
  SystemAdmin = 'system_admin',
  Management = 'management',
  QcInspector = 'qc_inspector',
  Reporter = 'reporter',
  // Maintenance (CMMS, issue #69) only: neither reaches any other section.
  TechnicalManager = 'technical_manager',
  PmInspector = 'pm_inspector',
  // Issue #130: everything Management, the technical manager, both
  // inspectors and the reporter do, plus reading the audit log — never
  // managing users, never a System-Admin-only power, never one of the System
  // Admin's dependency exceptions.
  FactoryManager = 'factory_manager',
}

/**
 * Who reaches the production sections — materials, components, products,
 * standard and daily BOMs, their reports and the dashboard: the roles those
 * sections were built for, and the factory manager. The maintenance roles
 * reach none of them (issue #69). A read open to "anyone signed in" names
 * this list rather than relying on `JwtAuthGuard` alone, so a new role
 * reaches nothing by default.
 */
export const PRODUCTION_ROLES: readonly Role[] = [
  Role.SystemAdmin,
  Role.Management,
  Role.QcInspector,
  Role.Reporter,
  Role.FactoryManager,
];

/**
 * Who oversees production — the orders list and an order by id, the
 * standard-BOM report and its export, the daily-BOM dashboard: every
 * production role but the QC inspector, who works the floor and keeps only
 * what registering and editing daily BOMs needs (issue #130).
 */
export const PRODUCTION_OVERSIGHT_ROLES: readonly Role[] =
  PRODUCTION_ROLES.filter((role) => role !== Role.QcInspector);
