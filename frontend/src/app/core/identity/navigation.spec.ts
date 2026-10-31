import { describe, expect, it } from 'vitest';

import { Role } from '../../api/model';
import {
  breadcrumbFor,
  canReach,
  containsPath,
  NavigationCategory,
  NavigationEntry,
  NAVIGATION,
  navigationFor,
  pagesIn,
  ShortcutGroup,
  shortcutsFor,
} from './navigation';

/** The tree as `label` / `label > child` lines, so an assertion reads like the menu itself. */
function outline(entries: readonly NavigationEntry[], depth = 0): string[] {
  return entries.flatMap((entry) => [
    `${'-'.repeat(depth)}${entry.label}`,
    ...(entry.kind === 'category' ? outline(entry.children, depth + 1) : []),
  ]);
}

function category(entries: readonly NavigationEntry[], id: string): NavigationCategory {
  const found = entries.find(
    (entry): entry is NavigationCategory => entry.kind === 'category' && entry.id === id,
  );
  if (found === undefined) {
    throw new Error(`no category ${id}`);
  }
  return found;
}

/** The groups as `group: shortcut` lines, in the order home renders them. */
function shortcutLines(groups: readonly ShortcutGroup[]): string[] {
  return groups.flatMap((group) =>
    group.shortcuts.map((shortcut) => `${group.label}: ${shortcut.label}`),
  );
}

const EVERY_PATH = [
  '',
  'boms',
  'standard-boms',
  'boms/dashboard',
  'products',
  'components',
  'materials',
  'equipment',
  'maintenance-activities',
  'pm-plans',
  'pm-schedule/daily',
  'pm-schedule/overview',
  'audit-log',
  'users',
];

describe('navigation', () => {
  // Issue #78: whatever categories come and go, «مدیریت سیستم» closes the menu and «اطلاعات پایه»
  // comes right before it.
  describe('top-level order', () => {
    const topLevelIds = (entries: readonly NavigationEntry[]): string[] =>
      entries.flatMap((entry) => (entry.kind === 'category' ? [entry.id] : []));

    it('ends the menu with master data, then system administration', () => {
      expect(topLevelIds(NAVIGATION).slice(-2)).toEqual(['master-data', 'system-administration']);
    });

    for (const role of Object.values(Role)) {
      it(`keeps system administration last and master data after every other category for ${role}`, () => {
        const closing = ['master-data', 'system-administration'];
        const ids = topLevelIds(navigationFor(role));

        expect(ids).toEqual([
          ...ids.filter((id) => !closing.includes(id)),
          ...closing.filter((id) => ids.includes(id)),
        ]);
      });
    }
  });

  describe('breadcrumbFor', () => {
    const labels = (path: string): string[] =>
      breadcrumbFor(NAVIGATION, path).map((crumb) => crumb.label);

    it('leads from home through the categories down to a page, for the toolbar', () => {
      expect(labels('products')).toEqual(['صفحهٔ اصلی', 'اطلاعات پایه', 'محصولات']);
      expect(labels('boms/dashboard')).toEqual([
        'صفحهٔ اصلی',
        'کنترل کیفیت',
        'گزارشات',
        'داشبورد روزانه',
      ]);
    });

    // Home no longer has a level per category, so a category has nowhere to link to.
    it('links home only — categories and the page itself are plain text', () => {
      expect(breadcrumbFor(NAVIGATION, 'boms/dashboard')).toEqual([
        { label: 'صفحهٔ اصلی', linksHome: true },
        { label: 'کنترل کیفیت', linksHome: false },
        { label: 'گزارشات', linksHome: false },
        { label: 'داشبورد روزانه', linksHome: false },
      ]);
    });

    it('has no trail on home itself', () => {
      expect(labels('')).toEqual([]);
    });

    it('has no trail for a path no page declares', () => {
      expect(labels('no-such-page')).toEqual([]);
    });
  });

  it('offers a System Admin the whole tree, in menu order', () => {
    expect(outline(navigationFor(Role.system_admin))).toEqual([
      'کنترل کیفیت',
      '-آنالیز های روزانه',
      '-آنالیز های استاندارد',
      '-گزارشات',
      '--داشبورد روزانه',
      'فنی',
      '-پرونده فنی تجهیزات',
      '-برنامه روزانه PM',
      '-گزارش PM',
      'اطلاعات پایه',
      '-محصولات',
      '-اجزا',
      '-مواد اولیه',
      '-تجهیزات / دستگاه',
      '-فعالیت های PM',
      'مدیریت سیستم',
      '-رویداد های سیستم',
      '-کاربران',
    ]);
  });

  it('withholds the system administration category from Management', () => {
    expect(outline(navigationFor(Role.management))).toEqual([
      'کنترل کیفیت',
      '-آنالیز های روزانه',
      '-آنالیز های استاندارد',
      '-گزارشات',
      '--داشبورد روزانه',
      'اطلاعات پایه',
      '-محصولات',
      '-اجزا',
      '-مواد اولیه',
    ]);
  });

  // A category is only worth offering if something inside it can be opened.
  it('hides every category with no reachable page from a QC Inspector', () => {
    expect(outline(navigationFor(Role.qc_inspector))).toEqual([
      'کنترل کیفیت',
      '-آنالیز های روزانه',
      '-آنالیز های استاندارد',
      '-گزارشات',
      '--داشبورد روزانه',
    ]);
  });

  // The two maintenance roles reach nothing outside maintenance: the BOM pages' API refuses them.
  it('offers a Technical Manager the maintenance master data and the whole technical category', () => {
    expect(outline(navigationFor(Role.technical_manager))).toEqual([
      'فنی',
      '-پرونده فنی تجهیزات',
      '-برنامه روزانه PM',
      '-گزارش PM',
      'اطلاعات پایه',
      '-تجهیزات / دستگاه',
      '-فعالیت های PM',
    ]);
  });

  it('offers a PM Inspector only the daily list and the overview', () => {
    expect(outline(navigationFor(Role.pm_inspector))).toEqual([
      'فنی',
      '-برنامه روزانه PM',
      '-گزارش PM',
    ]);
  });

  it('leads from home through «فنی» to the daily PM list', () => {
    expect(breadcrumbFor(NAVIGATION, 'pm-schedule/daily').map((crumb) => crumb.label)).toEqual([
      'صفحهٔ اصلی',
      'فنی',
      'برنامه روزانه PM',
    ]);
  });

  it('offers a Reporter the same as a QC Inspector', () => {
    expect(navigationFor(Role.reporter)).toEqual(navigationFor(Role.qc_inspector));
  });

  it('offers an anonymous visitor nothing', () => {
    expect(navigationFor(null)).toEqual([]);
  });

  it('lists the pages under a category, nested ones included, in menu order', () => {
    const qualityControl = category(navigationFor(Role.system_admin), 'quality-control');

    expect(pagesIn(qualityControl).map((page) => page.path)).toEqual([
      'boms',
      'standard-boms',
      'boms/dashboard',
    ]);
  });

  it('tells whether a category holds a path, at any depth', () => {
    const qualityControl = category(navigationFor(Role.system_admin), 'quality-control');

    expect(containsPath(qualityControl, 'boms/dashboard')).toBe(true);
    expect(containsPath(qualityControl, 'users')).toBe(false);
  });

  // Issue #79: each role's frequent tasks, as approved in `role-based-home-page.feature`.
  describe('shortcutsFor', () => {
    const expected: Record<Role, readonly string[]> = {
      [Role.qc_inspector]: [
        'کنترل کیفیت: ثبت آنالیز روزانه جدید',
        'کنترل کیفیت: آنالیز های روزانه',
        'کنترل کیفیت: آنالیز های استاندارد',
      ],
      [Role.management]: [
        'کنترل کیفیت: داشبورد روزانه',
        'کنترل کیفیت: آنالیز های روزانه',
        'کنترل کیفیت: آنالیز های استاندارد',
        'اطلاعات پایه: محصولات',
      ],
      [Role.reporter]: ['کنترل کیفیت: آنالیز های استاندارد'],
      [Role.pm_inspector]: ['فنی: برنامه روزانه PM'],
      [Role.technical_manager]: [
        'فنی: برنامه روزانه PM',
        'فنی: وضعیت تعمیرات و نگهداری',
        'فنی: برنامه PM تجهیزات',
      ],
      // Groups follow the menu's order, not the table's: «مدیریت سیستم» is last here as it is there.
      [Role.system_admin]: [
        'کنترل کیفیت: داشبورد روزانه',
        'کنترل کیفیت: آنالیز های استاندارد',
        'فنی: وضعیت تعمیرات و نگهداری',
        'مدیریت سیستم: رویداد های سیستم',
      ],
    };

    for (const role of Object.values(Role)) {
      it(`offers ${role} exactly its approved shortcuts, grouped in menu order`, () => {
        expect(shortcutLines(shortcutsFor(role))).toEqual(expected[role]);
      });
    }

    it('names each group by its top-level category, with no group left empty', () => {
      const groups = shortcutsFor(Role.management);

      expect(groups.map((group) => [group.id, group.label])).toEqual([
        ['quality-control', 'کنترل کیفیت'],
        ['master-data', 'اطلاعات پایه'],
      ]);
      expect(groups.every((group) => group.shortcuts.length > 0)).toBe(true);
    });

    // The dashboard is nested under «گزارشات», yet its group is the top-level category.
    it('groups a nested page under its top-level category', () => {
      expect(shortcutsFor(Role.management)[0].shortcuts[0]).toMatchObject({
        path: 'boms/dashboard',
        label: 'داشبورد روزانه',
      });
    });

    it('starts a registration through the daily BOMs page’s own query parameter', () => {
      expect(shortcutsFor(Role.qc_inspector)[0].shortcuts[0]).toEqual({
        path: 'boms',
        label: 'ثبت آنالیز روزانه جدید',
        queryParams: { register: 'true' },
        creates: true,
      });
    });

    it('links an ordinary shortcut to its page with no query parameters', () => {
      expect(shortcutsFor(Role.reporter)[0].shortcuts[0]).toEqual({
        path: 'standard-boms',
        label: 'آنالیز های استاندارد',
        queryParams: null,
        creates: false,
      });
    });

    // The approved wording, not the menu's: the menu was renamed after the scenarios were agreed.
    it('keeps the menu’s own labels for the two pages whose shortcuts are worded differently', () => {
      expect(outline(navigationFor(Role.technical_manager))).toContain('-گزارش PM');
      expect(outline(navigationFor(Role.technical_manager))).toContain('-پرونده فنی تجهیزات');
    });

    it('never offers a shortcut to a page the role cannot reach', () => {
      for (const role of Object.values(Role)) {
        const paths = shortcutsFor(role).flatMap((group) => group.shortcuts.map((s) => s.path));
        expect(paths.every((path) => canReach(path, role))).toBe(true);
      }
    });

    it('offers an anonymous visitor nothing', () => {
      expect(shortcutsFor(null)).toEqual([]);
    });
  });

  describe('canReach — the per-page rules, unchanged by the tree', () => {
    const expected: Record<Role, readonly string[]> = {
      [Role.system_admin]: EVERY_PATH,
      [Role.technical_manager]: [
        '',
        'equipment',
        'maintenance-activities',
        'pm-plans',
        'pm-schedule/daily',
        'pm-schedule/overview',
      ],
      [Role.pm_inspector]: ['', 'pm-schedule/daily', 'pm-schedule/overview'],
      [Role.management]: [
        '',
        'boms',
        'standard-boms',
        'boms/dashboard',
        'products',
        'components',
        'materials',
      ],
      [Role.qc_inspector]: ['', 'boms', 'standard-boms', 'boms/dashboard'],
      [Role.reporter]: ['', 'boms', 'standard-boms', 'boms/dashboard'],
    };

    for (const role of Object.values(Role)) {
      it(`lets ${role} reach exactly its pages`, () => {
        expect(EVERY_PATH.filter((path) => canReach(path, role))).toEqual(expected[role]);
      });
    }

    it('denies a path no page declares, whatever the role', () => {
      expect(canReach('no-such-page', Role.system_admin)).toBe(false);
    });

    // A category is not a page: it has no route, so its id must never pass for a path.
    it('denies a category id used as a path', () => {
      expect(canReach('quality-control', Role.system_admin)).toBe(false);
    });

    // An anonymous visitor has no role: `authGuard` sends them to log in before this is consulted,
    // but nothing may fall open in the window before it does.
    it('denies every page when there is no role', () => {
      expect(EVERY_PATH.some((path) => canReach(path, null))).toBe(false);
    });
  });
});
