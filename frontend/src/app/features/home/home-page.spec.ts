import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Role } from '../../api/model';
import { CurrentUserStore } from '../../core/identity/current-user-store';
import { SessionStore } from '../../core/identity/session-store';
import { HomePage } from './home-page';
import { fakeAccessToken } from '../../core/identity/testing/fake-access-token';

const PAGE_PATHS = [
  'boms',
  'standard-boms',
  'boms/dashboard',
  'products',
  'audit-log',
  'pm-plans',
  'pm-schedule/daily',
  'pm-schedule/overview',
];

describe('HomePage', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: '', component: HomePage },
          ...PAGE_PATHS.map((path) => ({ path, children: [] })),
        ]),
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    TestBed.inject(SessionStore).store(fakeAccessToken());
  });

  afterEach(() => {
    httpMock.verify();
  });

  /** Opens home for a signed-in user of the given role. */
  async function openHomeAs(
    role: Role,
  ): Promise<{ harness: RouterTestingHarness; page: HTMLElement }> {
    const pending = TestBed.inject(CurrentUserStore).load();
    httpMock
      .expectOne({ method: 'GET', url: '/api/users/me' })
      .flush({ id: '1', name: 'Sina Ghadrdan', username: 'sina.q', role });
    await pending;

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/', HomePage);
    await harness.fixture.whenStable();

    return { harness, page: harness.routeNativeElement as HTMLElement };
  }

  /** Every group section, as the region a screen reader names it: by the heading it points at. */
  function groups(page: HTMLElement): HTMLElement[] {
    return [...page.querySelectorAll<HTMLElement>('section[aria-labelledby]')];
  }

  function groupName(page: HTMLElement, section: HTMLElement): string | undefined {
    const id = section.getAttribute('aria-labelledby') ?? '';
    return page.querySelector(`[id="${id}"]`)?.textContent?.trim();
  }

  /** The shortcuts as `group: shortcut` lines — the pairs the acceptance scenarios compare. */
  function shortcutLines(page: HTMLElement): string[] {
    return groups(page).flatMap((section) =>
      [...section.querySelectorAll('a')].map(
        (link) => `${groupName(page, section)}: ${link.textContent?.trim()}`,
      ),
    );
  }

  function shortcut(page: HTMLElement, label: string): HTMLAnchorElement {
    const link = [...page.querySelectorAll<HTMLAnchorElement>('section a')].find(
      (candidate) => candidate.textContent?.trim() === label,
    );
    if (link === undefined) {
      throw new Error(`no shortcut "${label}"`);
    }
    return link;
  }

  it('greets the signed-in user by name in its one level-one heading', async () => {
    const { page } = await openHomeAs(Role.system_admin);

    const headings = page.querySelectorAll('h1');
    expect(headings).toHaveLength(1);
    expect(headings[0].textContent?.trim()).toBe('خوش آمدید، Sina Ghadrdan');
  });

  it('offers a QC Inspector registration, the daily list and the standards, under quality control', async () => {
    const { page } = await openHomeAs(Role.qc_inspector);

    expect(shortcutLines(page)).toEqual([
      'کنترل کیفیت: ثبت آنالیز روزانه جدید',
      'کنترل کیفیت: آنالیز های روزانه',
      'کنترل کیفیت: آنالیز های استاندارد',
    ]);
  });

  it('groups a System Admin’s shortcuts in menu order, one section per category', async () => {
    const { page } = await openHomeAs(Role.system_admin);

    expect(groups(page).map((section) => groupName(page, section))).toEqual([
      'کنترل کیفیت',
      'فنی',
      'مدیریت سیستم',
    ]);
    expect(shortcutLines(page)).toEqual([
      'کنترل کیفیت: داشبورد روزانه',
      'کنترل کیفیت: آنالیز های استاندارد',
      'فنی: وضعیت تعمیرات و نگهداری',
      'مدیریت سیستم: رویداد های سیستم',
    ]);
  });

  it('names each group with a level-two heading holding exactly the category label', async () => {
    const { page } = await openHomeAs(Role.management);

    const headings = groups(page).map((section) => {
      const id = section.getAttribute('aria-labelledby') ?? '';
      return page.querySelector(`[id="${id}"]`);
    });
    expect(headings.map((heading) => heading?.tagName)).toEqual(['H2', 'H2']);
    expect(headings.map((heading) => heading?.textContent?.trim())).toEqual([
      'کنترل کیفیت',
      'اطلاعات پایه',
    ]);
  });

  it('offers a PM Inspector only the daily PM list', async () => {
    const { page } = await openHomeAs(Role.pm_inspector);

    expect(shortcutLines(page)).toEqual(['فنی: برنامه روزانه PM']);
  });

  // The accessible name is the label alone: the icon is decoration.
  it('hides each shortcut’s icon from assistive technology', async () => {
    const { page } = await openHomeAs(Role.technical_manager);

    const link = shortcut(page, 'برنامه PM تجهیزات');
    const icons = [...link.querySelectorAll('mat-icon, svg')];
    expect(icons.length).toBeGreaterThan(0);
    expect(icons.every((icon) => icon.closest('[aria-hidden="true"]') !== null)).toBe(true);
  });

  it('opens the page a shortcut names', async () => {
    const { harness, page } = await openHomeAs(Role.management);

    shortcut(page, 'داشبورد روزانه').click();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/boms/dashboard');
  });

  it('starts a daily-BOM registration through the daily BOMs page', async () => {
    const { page } = await openHomeAs(Role.qc_inspector);

    expect(shortcut(page, 'ثبت آنالیز روزانه جدید').getAttribute('href')).toBe(
      '/boms?register=true',
    );
    expect(shortcut(page, 'آنالیز های روزانه').getAttribute('href')).toBe('/boms');
  });

  // The menu tree is the drawer's job now; home has no drill-down of its own.
  it('draws no category cards and no drill-down links', async () => {
    const { page } = await openHomeAs(Role.system_admin);

    expect(page.querySelector('a[href*="category="]')).toBeNull();
  });
});
