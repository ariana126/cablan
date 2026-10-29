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
}

/**
 * Who reaches the production sections — materials, components, products,
 * standard and daily BOMs, their reports and the dashboard: the four roles
 * those sections were built for. The maintenance roles reach none of them
 * (issue #69). A read open to "anyone signed in" names this list rather than
 * relying on `JwtAuthGuard` alone, so a new role reaches nothing by default.
 */
export const PRODUCTION_ROLES: readonly Role[] = [
  Role.SystemAdmin,
  Role.Management,
  Role.QcInspector,
  Role.Reporter,
];
