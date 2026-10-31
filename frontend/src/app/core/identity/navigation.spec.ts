import { describe, expect, it } from 'vitest';

import { Role } from '../../api/model';
import {
  breadcrumbFor,
  canReach,
  categoryTrail,
  containsPath,
  NavigationCategory,
  NavigationEntry,
  NAVIGATION,
  navigationFor,
  pagesIn,
} from './navigation';

/** The tree as `label` / `label > child` lines, so an assertion reads like the menu itself. */
function outline(entries: readonly NavigationEntry[], depth = 0): string[] {
  return entries.flatMap((entry) => [
    `${'-'.repeat(depth)}${entry.label}`,
    ...(entry.kind === 'category' ? outline(entry.children, depth + 1) : []),
  ]);
}

function category(entries: readonly NavigationEntry[], id: string): NavigationCategory {
  const trail = categoryTrail(entries, id);
  const found = trail.at(-1);
  if (found === undefined) {
    throw new Error(`no category ${id}`);
  }
  return found;
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
  it('describes each top-level category in one sentence, for the home page cards', () => {
    const described = NAVIGATION.filter((entry) => entry.kind === 'category').map(
      (entry) => entry.description,
    );

    expect(described).toEqual([
      'وزن مواد اولیهٔ هر سفارش را ثبت و با آنالیز استاندارد مقایسه کنید.',
      'برنامهٔ تعمیرات پیشگیرانهٔ تجهیزات، کارهای سررسیدهٔ هر روز و سابقهٔ انجام آن‌ها.',
      'داده‌های پایه‌ای که آنالیزها و برنامه‌های تعمیرات بر آن‌ها ساخته می‌شوند.',
      'کاربران و رویدادهای ثبت‌شده در سامانه.',
    ]);
  });

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
    const labels = (path: string, category: string | null = null): string[] =>
      breadcrumbFor(NAVIGATION, path, category).map((crumb) => crumb.label);

    it('leads from home through the categories down to a page, for the toolbar', () => {
      expect(labels('products')).toEqual(['صفحهٔ اصلی', 'اطلاعات پایه', 'محصولات']);
      expect(labels('boms/dashboard')).toEqual([
        'صفحهٔ اصلی',
        'کنترل کیفیت',
        'گزارشات',
        'داشبورد روزانه',
      ]);
    });

    it('links home to the top level and each category to its own level on home', () => {
      expect(breadcrumbFor(NAVIGATION, 'boms/dashboard', null)).toEqual([
        { label: 'صفحهٔ اصلی', category: null },
        { label: 'کنترل کیفیت', category: 'quality-control' },
        { label: 'گزارشات', category: 'reports' },
        { label: 'داشبورد روزانه', category: null },
      ]);
    });

    it('leads from home down to the category on show at a level of home', () => {
      expect(labels('', 'quality-control')).toEqual(['صفحهٔ اصلی', 'کنترل کیفیت']);
      expect(labels('', 'reports')).toEqual(['صفحهٔ اصلی', 'کنترل کیفیت', 'گزارشات']);
    });

    it('has no trail at the top level of home', () => {
      expect(labels('')).toEqual([]);
    });

    // A withheld category must look exactly like a made-up one, as on the home page itself.
    it('has no trail for a category these entries do not hold', () => {
      expect(labels('', 'no-such-category')).toEqual([]);
      expect(breadcrumbFor(navigationFor(Role.reporter), '', 'system-administration')).toEqual([]);
    });

    it('ignores a category off home, where it selects nothing', () => {
      expect(labels('products', 'quality-control')).toEqual([
        'صفحهٔ اصلی',
        'اطلاعات پایه',
        'محصولات',
      ]);
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
      '-برنامه PM تجهیزات',
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
      '-برنامه PM تجهیزات',
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
    expect(breadcrumbFor(NAVIGATION, 'pm-schedule/daily', null)).toEqual([
      { label: 'صفحهٔ اصلی', category: null },
      { label: 'فنی', category: 'technical' },
      { label: 'برنامه روزانه PM', category: null },
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

  it('traces the categories from the top down to a nested one', () => {
    expect(
      categoryTrail(navigationFor(Role.system_admin), 'reports').map((entry) => entry.id),
    ).toEqual(['quality-control', 'reports']);
  });

  it('traces nothing for a category the role cannot see', () => {
    expect(categoryTrail(navigationFor(Role.management), 'system-administration')).toEqual([]);
  });

  it('traces nothing for an unknown category', () => {
    expect(categoryTrail(navigationFor(Role.system_admin), 'no-such-category')).toEqual([]);
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
