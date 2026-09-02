import { Role } from '../../api/model';

/** One place in the drawer, and one row of the access rules. */
export interface Destination {
  /** The route path, exactly as `app.routes.ts` declares it. `''` is home. */
  readonly path: string;
  readonly label: string;
  readonly roles: readonly Role[];
}

const EVERYONE = [Role.system_admin, Role.management, Role.qc_inspector, Role.reporter] as const;
const MANAGERS = [Role.system_admin, Role.management] as const;
const ADMINS = [Role.system_admin] as const;

/**
 * Every destination the app navigates to, in the order the drawer renders them.
 *
 * **This is the single source of truth for who may reach what.** The drawer reads it to decide
 * what to offer, `app.routes.ts` reads it to decide what to render, and the home page reads it to
 * decide what to link — so none of the three can drift from the other two.
 *
 * `/login` is deliberately absent: it is the one page with no session, and the shell renders no
 * drawer there.
 *
 * **This is not a security boundary.** It ships in the bundle and anyone can read it — the same
 * caveat `auth-guard.ts` carries. The API's `RolesGuard` is what actually enforces access; this
 * only keeps the UI from advertising a page the API would refuse.
 */
export const DESTINATIONS: readonly Destination[] = [
  { path: '', label: 'صفحهٔ اصلی', roles: EVERYONE },
  // Every role, deliberately: the dashboard's API has no `@Roles()` either, and the Reporter —
  // the one role excluded from every daily-BOM write — is exactly who it exists for.
  { path: 'boms/dashboard', label: 'داشبورد روزانه', roles: EVERYONE },
  { path: 'boms', label: 'آنالیزهای روزانه', roles: EVERYONE },
  { path: 'standard-boms', label: 'آنالیزهای استاندارد', roles: EVERYONE },
  { path: 'audit-log', label: 'رویدادهای سیستم', roles: ADMINS },
  { path: 'products', label: 'محصولات', roles: MANAGERS },
  { path: 'components', label: 'اجزا', roles: MANAGERS },
  { path: 'materials', label: 'مواد اولیه', roles: MANAGERS },
  { path: 'users', label: 'کاربران', roles: ADMINS },
];

/** The destinations this role may reach, in `DESTINATIONS` order. `null` means anonymous. */
export function destinationsFor(role: Role | null): readonly Destination[] {
  return DESTINATIONS.filter((destination) => canReach(destination.path, role));
}

/**
 * Whether this role may reach this path. An unknown path is denied — a path with no row here has
 * no rule, and falling open would make every future route public by omission.
 */
export function canReach(path: string, role: Role | null): boolean {
  if (role === null) {
    return false;
  }

  const destination = DESTINATIONS.find((candidate) => candidate.path === path);

  return destination !== undefined && destination.roles.includes(role);
}
