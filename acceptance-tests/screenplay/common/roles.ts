/**
 * The four roles the system recognises, written exactly as the business itself writes them —
 * this is also the literal Persian text repeated across the whole spec suite's authorisation
 * rules (e.g. bom-registration/registring-component.feature's
 * "قانون: فقط مدیریت و مدیر سیستم مجاز به ثبت، ویرایش یا حذف جز هستند").
 */
export type SystemRole =
  'مدیر سیستم' | 'مدیریت' | 'بازرس کنترل کیفیت' | 'گزارشگیر';

const allSystemRoles: SystemRole[] = [
  'مدیر سیستم',
  'مدیریت',
  'بازرس کنترل کیفیت',
  'گزارشگیر',
];

/**
 * The wire-level role identifiers the backend accepts in a `users` request body and returns from
 * one — the lowercase snake_case values of `backend/src/framework/domain/role.ts`'s `Role` enum
 * (`SystemAdmin = 'system_admin'`, etc.). That file is the source of truth; this map is a manual
 * mirror of its string values, not an import — this suite never imports backend code (see the
 * "hard boundaries" acceptance-tests operates under) — so keep the two in sync by eye if that
 * enum's values ever change.
 */
const apiRoleBySystemRole: Record<SystemRole, string> = {
  'مدیر سیستم': 'system_admin',
  مدیریت: 'management',
  'بازرس کنترل کیفیت': 'qc_inspector',
  گزارشگیر: 'reporter',
};

export const apiRoleFor = (role: SystemRole): string =>
  apiRoleBySystemRole[role];

/**
 * Guards a value read out of a Gherkin table/step (which Cucumber hands over as a bare `string`)
 * really is one of the four valid roles, so a typo in a `.feature` file fails loudly here rather
 * than silently registering a user with an unintended role.
 */
export const asSystemRole = (value: string): SystemRole => {
  const match = allSystemRoles.find((role) => role === value);
  if (!match) {
    throw new Error(
      `"${value}" is not one of the system's roles: ${allSystemRoles.join(', ')}.`,
    );
  }
  return match;
};

/** A role value guaranteed not to be one of the four valid ones, for the invalid-role rule. */
export const anInvalidApiRole = 'NOT_A_REAL_ROLE';
