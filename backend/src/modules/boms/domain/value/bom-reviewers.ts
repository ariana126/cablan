import { Role } from '@framework/domain';

/**
 * Who may review daily BOMs — approve or reject them: management and the
 * system admin; a QC inspector registers and edits them but never vouches
 * for them. One list for both uses, so they cannot drift apart: the
 * controller guards the approve/reject endpoints with it (`@Roles`), and
 * `BomEditor` reads it to tell whether an edit is a reviewer's, to be noted
 * when the BOM is approved.
 */
export const BOM_REVIEWER_ROLES: readonly Role[] = [
  Role.Management,
  Role.SystemAdmin,
];

/** `null` — an unknown or deleted user — may not review. */
export function mayReviewBoms(role: Role | null): boolean {
  return role !== null && BOM_REVIEWER_ROLES.includes(role);
}
