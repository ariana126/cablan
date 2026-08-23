// The four roles the system recognises. Shared across every feature module —
// RBAC (`@Roles()` / `RolesGuard`) lives in `framework/infrastructure/http/`
// precisely so no module has to duplicate this enum or import another
// module's copy of it.
export enum Role {
  SystemAdmin = 'system_admin',
  Management = 'management',
  QcInspector = 'qc_inspector',
  Reporter = 'reporter',
}
