import { Role } from '../../api/model';

/**
 * Which roles may *write* in each BOM domain — the affordance side of the API's own `@Roles()`.
 *
 * `navigation.ts` decides which *pages* a role may reach; this decides which *actions* a role may
 * take once it is on one. Both BOM pages are reachable by everyone, because browsing, filtering and
 * exporting carry no role restriction at all — the گزارشگیر (Reporter) role exists to read exactly
 * those reports. What differs per role is register/edit/delete, and the two domains draw that line
 * in different places:
 *
 * - **Daily BOMs** — بازرس کنترل کیفیت، مدیریت، مدیر سیستم may write
 *   (`registring-bom.feature`: «فقط بازرس کنترل کیفیت، مدیریت و مدیر سیستم مجاز به ثبت، ویرایش یا
 *   حذف آنالیز روزانه هستند»).
 * - **Standard BOMs** — مدیریت و مدیر سیستم only; a QC inspector reads them but never edits them
 *   (`registring-standard-bom.feature`: «فقط مدیریت و مدیر سیستم مجاز به ثبت، ویرایش یا حذف آنالیز
 *   استاندارد هستند»).
 *
 * گزارشگیر writes in neither.
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
const BOM_WRITERS: readonly Role[] = [Role.system_admin, Role.management, Role.qc_inspector];

const STANDARD_BOM_WRITERS: readonly Role[] = [Role.system_admin, Role.management];

/** Whether this role may register, edit or delete a daily BOM. */
export function canManageBoms(role: Role | null): boolean {
  return role !== null && BOM_WRITERS.includes(role);
}

/** Who may review a daily BOM — approve or reject it — `approving-bom.feature`: «مدیریت و مدیر
 * سیستم». The same two roles that write standard BOMs, but a separate rule: the two happen to
 * agree today, and neither should move when the other does. */
const BOM_APPROVERS: readonly Role[] = [Role.system_admin, Role.management];

/** Whether this role may approve or reject a daily BOM, or correct it from the dashboard. */
export function canApproveBoms(role: Role | null): boolean {
  return role !== null && BOM_APPROVERS.includes(role);
}

/** Whether this role may register, edit or delete a standard BOM. */
export function canManageStandardBoms(role: Role | null): boolean {
  return role !== null && STANDARD_BOM_WRITERS.includes(role);
}

/** Who may revert a bulk material import — `viewing-audit-log.feature`: «فقط مدیر سیستم مجاز به
 * برگرداندن بارگذاری گروهی است». Management imports, but only the System Admin undoes one. */
const MATERIAL_IMPORT_REVERTERS: readonly Role[] = [Role.system_admin];

/** Whether this role may revert a bulk material import from its audit-log entry. */
export function canRevertMaterialImports(role: Role | null): boolean {
  return role !== null && MATERIAL_IMPORT_REVERTERS.includes(role);
}
