import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Role } from '../../api/model';
import { CurrentUserStore } from '../../core/identity/current-user-store';
import { SessionStore } from '../../core/identity/session-store';
import { HomePage } from './home-page';

const PAGE_PATHS = [
  'boms',
  'standard-boms',
  'boms/dashboard',
  'products',
  'components',
  'materials',
  'audit-log',
  'users',
];

describe('HomePage', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // The same input binding `app.config.ts` turns on, so `?category=` reaches the page.
        provideRouter(
          [
            { path: '', component: HomePage },
            ...PAGE_PATHS.map((path) => ({ path, children: [] })),
          ],
          withComponentInputBinding(),
        ),
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    TestBed.inject(SessionStore).store('a-valid-token');
  });

  afterEach(() => {
    httpMock.verify();
  });

  /** Opens home at this URL for a signed-in user of the given role. */
  async function openHomeAs(
    role: Role,
    url = '/',
  ): Promise<{ harness: RouterTestingHarness; page: HTMLElement }> {
    const pending = TestBed.inject(CurrentUserStore).load();
    httpMock
      .expectOne({ method: 'GET', url: '/api/users/me' })
      .flush({ id: '1', name: 'Sina Ghadrdan', username: 'sina.q', role });
    await pending;

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, HomePage);
    await harness.fixture.whenStable();

    return { harness, page: harness.routeNativeElement as HTMLElement };
  }

  /** The labels of the entries at the level on show, in order. */
  function entryLabels(page: HTMLElement): string[] {
    return [...page.querySelectorAll('.entries a')].map((link) => link.textContent?.trim() ?? '');
  }

  function entry(page: HTMLElement, label: string): HTMLAnchorElement {
    const link = [...page.querySelectorAll<HTMLAnchorElement>('.entries a')].find(
      (candidate) => candidate.textContent?.trim() === label,
    );
    if (link === undefined) {
      throw new Error(`no entry "${label}"`);
    }
    return link;
  }

  async function select(harness: RouterTestingHarness, link: HTMLElement): Promise<void> {
    link.click();
    await harness.fixture.whenStable();
  }

  it('greets the signed-in user by name', async () => {
    const { page } = await openHomeAs(Role.system_admin);

    expect(page.querySelector('h1')?.textContent).toContain('Sina Ghadrdan');
  });

  it('starts at the top-level categories, in menu order', async () => {
    const { page } = await openHomeAs(Role.system_admin);

    expect(entryLabels(page)).toEqual(['کنترل کیفیت', 'اطلاعات پایه', 'مدیریت سیستم']);
  });

  it('offers a Reporter only quality control', async () => {
    const { page } = await openHomeAs(Role.reporter);

    expect(entryLabels(page)).toEqual(['کنترل کیفیت']);
  });

  it('shows the items below a category when it is selected', async () => {
    const { harness, page } = await openHomeAs(Role.system_admin);

    await select(harness, entry(page, 'کنترل کیفیت'));

    expect(TestBed.inject(Router).url).toBe('/?category=quality-control');
    expect(entryLabels(page)).toEqual(['آنالیز های روزانه', 'آنالیز های استاندارد', 'گزارشات']);
    expect(page.querySelector('h2')?.textContent).toContain('کنترل کیفیت');
  });

  it('drills into a nested category', async () => {
    const { harness, page } = await openHomeAs(Role.system_admin, '/?category=quality-control');

    await select(harness, entry(page, 'گزارشات'));

    expect(entryLabels(page)).toEqual(['داشبورد روزانه']);
  });

  it('navigates to a page when it is selected', async () => {
    const { harness, page } = await openHomeAs(Role.system_admin, '/?category=reports');

    await select(harness, entry(page, 'داشبورد روزانه'));

    expect(TestBed.inject(Router).url).toBe('/boms/dashboard');
  });

  // The breadcrumb is the way back up: every level above the current one is a link to it.
  it('leads back up one level at a time, then to the top', async () => {
    const { harness, page } = await openHomeAs(Role.system_admin, '/?category=reports');
    const crumbs = (): HTMLAnchorElement[] => [
      ...page.querySelectorAll<HTMLAnchorElement>('nav.trail a'),
    ];

    await select(
      harness,
      crumbs().find((link) => link.textContent?.includes('کنترل کیفیت'))!,
    );
    expect(TestBed.inject(Router).url).toBe('/?category=quality-control');

    await select(harness, crumbs()[0]);
    expect(TestBed.inject(Router).url).toBe('/');
    expect(entryLabels(page)).toEqual(['کنترل کیفیت', 'اطلاعات پایه', 'مدیریت سیستم']);
  });

  it('shows no way back up at the top level', async () => {
    const { page } = await openHomeAs(Role.system_admin);

    expect(page.querySelector('nav.trail')).toBeNull();
  });

  // A withheld category must look exactly like a made-up one: both fall back to the top.
  it('shows the top level for a category the role cannot see', async () => {
    const { page } = await openHomeAs(Role.reporter, '/?category=system-administration');

    expect(entryLabels(page)).toEqual(['کنترل کیفیت']);
  });

  // Swapping the list in place gives a screen reader no sign anything happened; landing on the new
  // heading is that sign.
  it('moves focus to the new level’s heading after drilling in', async () => {
    const { harness, page } = await openHomeAs(Role.system_admin);

    await select(harness, entry(page, 'اطلاعات پایه'));

    expect(document.activeElement).toBe(page.querySelector('h2'));
  });
});
