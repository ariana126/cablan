import { describe, expect, it } from 'vitest';

import { Role } from '../../api/model';
import {
  breadcrumbTo,
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
      'محصولات، اجزا و مواد اولیه‌ای که آنالیزها از آن‌ها ساخته می‌شوند.',
      'کاربران و رویدادهای ثبت‌شده در سامانه.',
    ]);
  });

  describe('breadcrumbTo', () => {
    it('lists the categories down to a page, then the page, for the toolbar', () => {
      expect(breadcrumbTo(NAVIGATION, 'products')).toEqual(['اطلاعات پایه', 'محصولات']);
      expect(breadcrumbTo(NAVIGATION, 'boms/dashboard')).toEqual([
        'کنترل کیفیت',
        'گزارشات',
        'داشبورد روزانه',
      ]);
    });

    it('has no trail for home, which sits outside the tree', () => {
      expect(breadcrumbTo(NAVIGATION, '')).toEqual([]);
    });

    it('has no trail for a path no page declares', () => {
      expect(breadcrumbTo(NAVIGATION, 'no-such-page')).toEqual([]);
    });
  });

  it('offers a System Admin the whole tree, in menu order', () => {
    expect(outline(navigationFor(Role.system_admin))).toEqual([
      'کنترل کیفیت',
      '-آنالیز های روزانه',
      '-آنالیز های استاندارد',
      '-گزارشات',
      '--داشبورد روزانه',
      'اطلاعات پایه',
      '-محصولات',
      '-اجزا',
      '-مواد اولیه',
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
