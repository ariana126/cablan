import { Role } from '../../api/model';
import { canManageBoms } from './permissions';

/** A routed page: one link in the menu, and one row of the access rules. */
export interface NavigationPage {
  readonly kind: 'page';
  /** The route path, exactly as `app.routes.ts` declares it. `''` is home. */
  readonly path: string;
  readonly label: string;
  readonly roles: readonly Role[];
}

/**
 * A heading that groups other entries. It has no route and no roles of its own: who sees it follows
 * entirely from who may reach something inside it.
 */
export interface NavigationCategory {
  readonly kind: 'category';
  /** Stable and unique across the whole tree — the drawer's DOM ids and home's group ids use it. */
  readonly id: string;
  readonly label: string;
  readonly children: readonly NavigationEntry[];
}

export type NavigationEntry = NavigationPage | NavigationCategory;

/**
 * The four roles of the BOM side of the product. Not "every role": the two maintenance roles reach
 * nothing outside maintenance, and the API refuses them every BOM, product, material and component
 * read too.
 */
const EVERYONE = [Role.system_admin, Role.management, Role.qc_inspector, Role.reporter] as const;
const MANAGERS = [Role.system_admin, Role.management] as const;
const ADMINS = [Role.system_admin] as const;
/** Who keeps the equipment, the activity catalog and the PM plans — the API's `TM`. */
const TECHNICAL_MANAGERS = [Role.system_admin, Role.technical_manager] as const;
/** Who works the PM schedule and records what was done — the API's `PM`. */
const PM_STAFF = [Role.system_admin, Role.technical_manager, Role.pm_inspector] as const;
/** Every signed-in role, whatever it may reach. */
const ANY_ROLE = Object.values(Role);

const page = (path: string, label: string, roles: readonly Role[]): NavigationPage => ({
  kind: 'page',
  path,
  label,
  roles,
});

const category = (
  id: string,
  label: string,
  children: readonly NavigationEntry[],
): NavigationCategory => ({ kind: 'category', id, label, children });

/**
 * Home sits outside the tree: the menu does not list it (the toolbar's brand links there instead),
 * and the home page offers the role's shortcuts into the tree (`shortcutsFor`). It is still a page
 * with a rule.
 */
const HOME = page('', 'صفحهٔ اصلی', ANY_ROLE);

/**
 * The operational categories — the work each role comes here to do. **A new top-level category goes
 * here**, never after `MASTER_DATA` or `SYSTEM_ADMINISTRATION`: see `NAVIGATION`.
 */
const WORK_AREAS: readonly NavigationCategory[] = [
  category('quality-control', 'کنترل کیفیت', [
    page('boms', 'آنالیز های روزانه', EVERYONE),
    page('standard-boms', 'آنالیز های استاندارد', EVERYONE),
    category('reports', 'گزارشات', [
      // Every role, deliberately: the dashboard's API has no `@Roles()` either, and the Reporter —
      // the one role excluded from every daily-BOM write — is exactly who it exists for.
      page('boms/dashboard', 'داشبورد روزانه', EVERYONE),
    ]),
  ]),
  category('technical', 'فنی', [
    page('pm-plans', 'پرونده فنی تجهیزات', TECHNICAL_MANAGERS),
    page('pm-schedule/daily', 'برنامه روزانه PM', PM_STAFF),
    page('pm-schedule/overview', 'گزارش PM', PM_STAFF),
  ]),
];

/** «اطلاعات پایه» — always second-to-last in the menu (issue #78). */
const MASTER_DATA = category('master-data', 'اطلاعات پایه', [
  page('products', 'محصولات', MANAGERS),
  page('components', 'اجزا', MANAGERS),
  page('materials', 'مواد اولیه', MANAGERS),
  page('equipment', 'تجهیزات / دستگاه', TECHNICAL_MANAGERS),
  page('maintenance-activities', 'فعالیت های PM', TECHNICAL_MANAGERS),
]);

/** «مدیریت سیستم» — always last in the menu (issue #78). */
const SYSTEM_ADMINISTRATION = category('system-administration', 'مدیریت سیستم', [
  page('audit-log', 'رویداد های سیستم', ADMINS),
  page('users', 'کاربران', ADMINS),
]);

/**
 * Every page the app navigates to, grouped the way the drawer presents them, in the order it renders
 * them — and the order of the home page's shortcut groups.
 *
 * **The top-level order is a rule, not a list** (issue #78): the work areas first, then «اطلاعات
 * پایه», then «مدیریت سیستم» last — for every role, whichever categories it sees, and for any
 * category added later, which belongs in `WORK_AREAS`.
 *
 * **This is the single source of truth for who may reach what.** The drawer reads it to decide
 * what to offer, `app.routes.ts` reads it (through `canReach`) to decide what to render, and the
 * home page's shortcuts (`shortcutsFor`) are filtered and grouped by it — so none of the three can
 * drift from the other two.
 * Roles live on the pages only; a category is visible exactly when one of its pages is.
 *
 * `/login` is deliberately absent: it is the one page with no session, and the shell renders no
 * drawer there.
 *
 * **This is not a security boundary.** It ships in the bundle and anyone can read it — the same
 * caveat `auth-guard.ts` carries. The API's `RolesGuard` is what actually enforces access; this
 * only keeps the UI from advertising a page the API would refuse.
 */
export const NAVIGATION: readonly NavigationEntry[] = [
  ...WORK_AREAS,
  MASTER_DATA,
  SYSTEM_ADMINISTRATION,
];

/** Every page in these entries, depth first — i.e. in the order the menu renders them. */
function flatten(entries: readonly NavigationEntry[]): readonly NavigationPage[] {
  return entries.flatMap((entry) => (entry.kind === 'page' ? [entry] : flatten(entry.children)));
}

/** Every page that carries a rule, home included. */
const PAGES: readonly NavigationPage[] = [HOME, ...flatten(NAVIGATION)];

/**
 * The tree as this role sees it: pages it cannot reach are removed, and so is any category left
 * with nothing in it. `null` means anonymous, who sees nothing.
 */
export function navigationFor(role: Role | null): readonly NavigationEntry[] {
  return prune(NAVIGATION, role);
}

function prune(entries: readonly NavigationEntry[], role: Role | null): readonly NavigationEntry[] {
  return entries.flatMap((entry): NavigationEntry[] => {
    if (entry.kind === 'page') {
      return role !== null && entry.roles.includes(role) ? [entry] : [];
    }
    const children = prune(entry.children, role);
    return children.length > 0 ? [{ ...entry, children }] : [];
  });
}

/** The pages under a category, at any depth, in menu order. */
export function pagesIn(category: NavigationCategory): readonly NavigationPage[] {
  return flatten(category.children);
}

/** Whether a category holds the page at this path, at any depth. */
export function containsPath(category: NavigationCategory, path: string): boolean {
  return pagesIn(category).some((candidate) => candidate.path === path);
}

/**
 * The entries from the top-level category down to the page at this path — empty when no page here
 * has the path (home sits outside the tree, so it has none).
 */
export function trailTo(
  entries: readonly NavigationEntry[],
  path: string,
): readonly NavigationEntry[] {
  for (const entry of entries) {
    if (entry.kind === 'page') {
      if (entry.path === path) {
        return [entry];
      }
      continue;
    }
    const below = trailTo(entry.children, path);
    if (below.length > 0) {
      return [entry, ...below];
    }
  }
  return [];
}

/**
 * One step of the toolbar's breadcrumb. Only home is a link: a category has no page of its own to
 * open (the drawer is where its pages are), and the last step is where the visitor stands.
 */
export interface Crumb {
  readonly label: string;
  readonly linksHome: boolean;
}

/**
 * The toolbar's breadcrumb: home, then the categories down to the page at `path`. Empty on home
 * itself and for a path no page here declares.
 */
export function breadcrumbFor(entries: readonly NavigationEntry[], path: string): readonly Crumb[] {
  const trail = trailTo(entries, path);
  if (trail.length === 0) {
    return [];
  }
  return [
    { label: HOME.label, linksHome: true },
    ...trail.map((entry) => ({ label: entry.label, linksHome: false })),
  ];
}

/**
 * Whether this role may reach this path. An unknown path is denied — a path with no page here has
 * no rule, and falling open would make every future route public by omission.
 */
export function canReach(path: string, role: Role | null): boolean {
  if (role === null) {
    return false;
  }

  const target = PAGES.find((candidate) => candidate.path === path);

  return target !== undefined && target.roles.includes(role);
}

/** One shortcut on the home page: a page to open, worded for the task it starts. */
export interface Shortcut {
  /** The page's route path, exactly as `NAVIGATION` declares it. */
  readonly path: string;
  readonly label: string;
  /** What the link adds to the URL, or `null` for the page as it opens from the menu. */
  readonly queryParams: Readonly<Record<string, string>> | null;
  /** Whether it starts a new record rather than opening a page to read. */
  readonly creates: boolean;
}

/** The shortcuts of one top-level category, named and ordered as the menu has them. */
export interface ShortcutGroup {
  readonly id: string;
  readonly label: string;
  readonly shortcuts: readonly Shortcut[];
}

/** A row of `SHORTCUTS`: a page by path, plus whatever the shortcut does differently from the menu. */
interface ShortcutRule {
  readonly path: string;
  /** Overrides the page's menu label. */
  readonly label?: string;
  readonly queryParams?: Readonly<Record<string, string>>;
  readonly creates?: boolean;
  /** An action rule the role must pass on top of reaching the page. */
  readonly allows?: (role: Role) => boolean;
}

const to = (path: string, rule: Omit<ShortcutRule, 'path'> = {}): ShortcutRule => ({
  path,
  ...rule,
});

/** Opens `/boms` with its registration dialog already open — see `BomsPage`'s `register` input. */
const REGISTER_DAILY_BOM = to('boms', {
  label: 'ثبت آنالیز روزانه جدید',
  queryParams: { register: 'true' },
  creates: true,
  allows: canManageBoms,
});

/**
 * Each role's frequent tasks (issue #79), as approved in the role-based home page scenarios. **A new
 * role or shortcut is one entry here** — `Record<Role, …>` makes a new role fail the typecheck until
 * it has one. A shortcut names a page by path only: its group is that page's top-level category, and
 * it shows only while `canReach` agrees, so it can never advertise a page the menu withholds. Within
 * a group the shortcuts keep this order; the groups themselves follow the menu.
 *
 * Two labels differ from the menu on purpose — the stakeholder approved these names before the
 * menu entries were renamed: «وضعیت تعمیرات و نگهداری» (menu «گزارش PM») and «برنامه PM تجهیزات»
 * (menu «پرونده فنی تجهیزات»).
 */
const SHORTCUTS: Readonly<Record<Role, readonly ShortcutRule[]>> = {
  [Role.qc_inspector]: [REGISTER_DAILY_BOM, to('boms'), to('standard-boms')],
  [Role.management]: [to('boms/dashboard'), to('boms'), to('standard-boms'), to('products')],
  [Role.reporter]: [to('standard-boms')],
  [Role.pm_inspector]: [to('pm-schedule/daily')],
  [Role.technical_manager]: [
    to('pm-schedule/daily'),
    to('pm-schedule/overview', { label: 'وضعیت تعمیرات و نگهداری' }),
    to('pm-plans', { label: 'برنامه PM تجهیزات' }),
  ],
  [Role.system_admin]: [
    to('audit-log'),
    to('boms/dashboard'),
    to('standard-boms'),
    to('pm-schedule/overview', { label: 'وضعیت تعمیرات و نگهداری' }),
  ],
};

/**
 * The home page's shortcuts for this role, grouped under the top-level categories that hold their
 * pages, in menu order. A group with nothing in it is left out; `null` (anonymous) gets nothing.
 */
export function shortcutsFor(role: Role | null): readonly ShortcutGroup[] {
  if (role === null) {
    return [];
  }
  const offered = SHORTCUTS[role].filter(
    (rule) => canReach(rule.path, role) && (rule.allows?.(role) ?? true),
  );
  return NAVIGATION.flatMap((top): ShortcutGroup[] => {
    if (top.kind !== 'category') {
      return [];
    }
    const shortcuts = offered
      .filter((rule) => containsPath(top, rule.path))
      .map((rule) => toShortcut(rule));
    return shortcuts.length > 0 ? [{ id: top.id, label: top.label, shortcuts }] : [];
  });
}

function toShortcut(rule: ShortcutRule): Shortcut {
  const target = PAGES.find((candidate) => candidate.path === rule.path);
  return {
    path: rule.path,
    label: rule.label ?? target?.label ?? rule.path,
    queryParams: rule.queryParams ?? null,
    creates: rule.creates ?? false,
  };
}
