import { Role } from '../../api/model';

/**
 * Which roles may *write* in each BOM domain — the affordance side of the API's own `@Roles()`.
 *
 * `navigation.ts` decides which *pages* a role may reach; this decides which *actions* a role may
 * take once it is on one. Both BOM pages are reachable by every production role (the standard-BOM
 * page by all but the QC inspector, issue #130), because browsing, filtering and exporting are the
 * گزارشگیر (Reporter) role's whole purpose. What differs per role is register/edit/delete, and the
 * two domains draw that line in different places:
 *
 * - **Daily BOMs** — بازرس کنترل کیفیت، مدیریت، مدیر کارخانه، مدیر سیستم may write
 *   (`registring-bom.feature`).
 * - **Standard BOMs** — مدیریت، مدیر کارخانه و مدیر سیستم only; the daily-BOM form still reads them
 *   for a QC inspector, who never edits them (`registring-standard-bom.feature`).
 *
 * گزارشگیر writes in neither. مدیر کارخانه (issue #130) writes wherever Management does, and
 * approves too — but holds none of the System Admin's own powers below.
 *
 * **This is not a security boundary**, for the same reason `navigation.ts` says it is not: it ships
 * in the bundle. The API's `RolesGuard` is what refuses the write; this only keeps the UI from
 * offering a button that would come back 403. Each feature's own `server-errors.ts` therefore keeps
 * its 403 handling exactly where it is — that is the answer to a role that changed mid-session, not
 * dead code.
 *
 * `null` means no role is known — anonymous, or a `GET /users/me` that failed. It writes nothing:
 * a missing answer must never fall open.
 */
const BOM_WRITERS: readonly Role[] = [
  Role.system_admin,
  Role.management,
  Role.qc_inspector,
  Role.factory_manager,
];

const STANDARD_BOM_WRITERS: readonly Role[] = [
  Role.system_admin,
  Role.management,
  Role.factory_manager,
];

/** Whether this role may register, edit or delete a daily BOM. */
export function canManageBoms(role: Role | null): boolean {
  return role !== null && BOM_WRITERS.includes(role);
}

/** Who may review a daily BOM — approve or reject it — `approving-bom.feature`: «مدیریت و مدیر
 * سیستم». The same two roles that write standard BOMs, but a separate rule: the two happen to
 * agree today, and neither should move when the other does. */
const BOM_APPROVERS: readonly Role[] = [Role.system_admin, Role.management, Role.factory_manager];

/** Whether this role may approve or reject a daily BOM, or correct it from the dashboard. */
export function canApproveBoms(role: Role | null): boolean {
  return role !== null && BOM_APPROVERS.includes(role);
}

/** Whether this role may register, edit or delete a standard BOM. */
export function canManageStandardBoms(role: Role | null): boolean {
  return role !== null && STANDARD_BOM_WRITERS.includes(role);
}

/** Who defines orders, assigns their MI codes and edits or deletes them (issue #101) — the API's
 * write roles on `/orders`. Every production role but the QC Inspector reads them (issue #130). */
const ORDER_WRITERS: readonly Role[] = [Role.system_admin, Role.management, Role.factory_manager];

export function canManageOrders(role: Role | null): boolean {
  return role !== null && ORDER_WRITERS.includes(role);
}

/** Who may revert a bulk material import — `viewing-audit-log.feature`: «فقط مدیر سیستم مجاز به
 * برگرداندن بارگذاری گروهی است». Management and the Factory Manager import, but only the System
 * Admin undoes one. */
const MATERIAL_IMPORT_REVERTERS: readonly Role[] = [Role.system_admin];

/** Whether this role may revert a bulk material import from its audit-log entry. */
export function canRevertMaterialImports(role: Role | null): boolean {
  return role !== null && MATERIAL_IMPORT_REVERTERS.includes(role);
}

/**
 * Issue #110's exceptions to issue #94's rule are the System Admin's alone — Technical Manager and
 * Factory Manager included, everyone else stays under it (`dependency-based-edit-delete-policy`). The API's
 * `@Roles(Role.SystemAdmin)` refuses the rest; these only decide what is offered.
 */
const SYSTEM_ADMIN_EXCEPTIONS: readonly Role[] = [Role.system_admin];

/** Whether this role is asked to confirm correcting the name (or a material's code) of a record
 * other records use — the correction then reaches every related record and history. */
export function canCorrectRecordsInUse(role: Role | null): boolean {
  return role !== null && SYSTEM_ADMIN_EXCEPTIONS.includes(role);
}

/** Whether this role may delete PM executions, deactivated plan rows and retired equipment. */
export function canDeleteMaintenanceRecords(role: Role | null): boolean {
  return role !== null && SYSTEM_ADMIN_EXCEPTIONS.includes(role);
}

/** Whether this role may delete a QC record (issue #119) — the System Admin alone, like the PM
 * records above; Management reads them but never deletes one. */
export function canDeleteQcRecords(role: Role | null): boolean {
  return role !== null && SYSTEM_ADMIN_EXCEPTIONS.includes(role);
}

/** Whether this role may put retired equipment back in service. */
export function canReactivateEquipment(role: Role | null): boolean {
  return role !== null && SYSTEM_ADMIN_EXCEPTIONS.includes(role);
}

/** Who imports PM plans from the plant's Excel matrix (issue #127) — the System Admin alone; the
 * Technical Manager, who manages plans one row at a time, is refused like everyone else. */
const PM_PLAN_IMPORTERS: readonly Role[] = [Role.system_admin];

/** Whether this role may import PM plans from Excel on `/pm-plans`. */
export function canImportPmPlans(role: Role | null): boolean {
  return role !== null && PM_PLAN_IMPORTERS.includes(role);
}
