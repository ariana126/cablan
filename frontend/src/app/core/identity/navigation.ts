import { Role } from '../../api/model';

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
  /** Stable and unique across the whole tree — the drawer's DOM ids and home's `?category=` use it. */
  readonly id: string;
  readonly label: string;
  /** One sentence about the work this area is for — the home page card's body. Top level only. */
  readonly description?: string;
  readonly children: readonly NavigationEntry[];
}

export type NavigationEntry = NavigationPage | NavigationCategory;

const EVERYONE = [Role.system_admin, Role.management, Role.qc_inspector, Role.reporter] as const;
const MANAGERS = [Role.system_admin, Role.management] as const;
const ADMINS = [Role.system_admin] as const;

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
  description?: string,
): NavigationCategory => ({ kind: 'category', id, label, children, description });

/**
 * Home sits outside the tree: the menu does not list it (the toolbar's brand links there instead),
 * and the home page *is* the tree, so it would only point at itself. It is still a page with a rule.
 */
const HOME = page('', 'صفحهٔ اصلی', EVERYONE);

/**
 * Every page the app navigates to, grouped the way the drawer and the home page present them, in
 * the order they render.
 *
 * **This is the single source of truth for who may reach what.** The drawer reads it to decide
 * what to offer, `app.routes.ts` reads it (through `canReach`) to decide what to render, and the
 * home page reads it to decide what to link — so none of the three can drift from the other two.
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
  category(
    'quality-control',
    'کنترل کیفیت',
    [
      page('boms', 'آنالیز های روزانه', EVERYONE),
      page('standard-boms', 'آنالیز های استاندارد', EVERYONE),
      category('reports', 'گزارشات', [
        // Every role, deliberately: the dashboard's API has no `@Roles()` either, and the Reporter —
        // the one role excluded from every daily-BOM write — is exactly who it exists for.
        page('boms/dashboard', 'داشبورد روزانه', EVERYONE),
      ]),
    ],
    'وزن مواد اولیهٔ هر سفارش را ثبت و با استاندارد مقایسه کنید.',
  ),
  category(
    'master-data',
    'اطلاعات پایه',
    [
      page('products', 'محصولات', MANAGERS),
      page('components', 'اجزا', MANAGERS),
      page('materials', 'مواد اولیه', MANAGERS),
    ],
    'محصولات، اجزا و مواد اولیه‌ای که آنالیزها از آن‌ها ساخته می‌شوند.',
  ),
  category(
    'system-administration',
    'مدیریت سیستم',
    [page('audit-log', 'رویداد های سیستم', ADMINS), page('users', 'کاربران', ADMINS)],
    'کاربران، نقش‌ها و رویدادهای ثبت‌شده در سامانه.',
  ),
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
 * The categories from the top of these entries down to the one with this id, inclusive — empty when
 * no category here has it, so an unknown or withheld id falls back to the top level.
 */
export function categoryTrail(
  entries: readonly NavigationEntry[],
  id: string,
): readonly NavigationCategory[] {
  for (const entry of entries) {
    if (entry.kind !== 'category') {
      continue;
    }
    if (entry.id === id) {
      return [entry];
    }
    const below = categoryTrail(entry.children, id);
    if (below.length > 0) {
      return [entry, ...below];
    }
  }
  return [];
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

/** The labels of `trailTo`, for the toolbar's breadcrumb. */
export function breadcrumbTo(entries: readonly NavigationEntry[], path: string): readonly string[] {
  return trailTo(entries, path).map((entry) => entry.label);
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
