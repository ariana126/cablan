import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Role } from '../../api/model';
import { CurrentUserStore } from '../../core/identity/current-user-store';
import { SessionStore } from '../../core/identity/session-store';
import { AppShell } from './app-shell';
import { fakeAccessToken } from '../../core/identity/testing/fake-access-token';

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

describe('AppShell', () => {
  let httpMock: HttpTestingController;
  let session: SessionStore;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // Real routes, so `routerLinkActive` has a navigation to compare against and every link the
        // drawer offers resolves rather than failing to match.
        provideRouter([
          { path: '', children: [] },
          { path: 'login', children: [] },
          ...PAGE_PATHS.map((path) => ({ path, children: [] })),
        ]),
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
  });

  afterEach(() => {
    httpMock.verify();
  });

  async function renderShell(url = '/'): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(AppShell);
    // `routerLinkActive` only resolves once a navigation has happened; without this the router sits
    // at its initial state and no link is ever active.
    await TestBed.inject(Router).navigateByUrl(url);
    await fixture.whenStable();

    return fixture.nativeElement as HTMLElement;
  }

  async function renderShellFor(role: Role, url = '/'): Promise<HTMLElement> {
    session.store(fakeAccessToken());
    const pending = TestBed.inject(CurrentUserStore).load();
    httpMock
      .expectOne({ method: 'GET', url: '/api/users/me' })
      .flush({ id: '1', name: 'Sina Ghadrdan', username: 'sina.q', role });
    await pending;

    return renderShell(url);
  }

  /** The drawer's entries a sighted user can see right now — collapsed branches excluded. */
  function visibleEntries(shell: HTMLElement): HTMLElement[] {
    return [...shell.querySelectorAll<HTMLElement>('nav a, nav button')].filter(
      (entry) => entry.closest('[hidden]') === null,
    );
  }

  function visibleLabels(shell: HTMLElement): string[] {
    return visibleEntries(shell).map((entry) => entry.textContent?.trim() ?? '');
  }

  function categoryButton(shell: HTMLElement, label: string): HTMLButtonElement {
    const button = [...shell.querySelectorAll<HTMLButtonElement>('nav button')].find(
      (candidate) => candidate.textContent?.trim() === label,
    );
    if (button === undefined) {
      throw new Error(`no category button "${label}"`);
    }
    return button;
  }

  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  it('offers a System Admin every top-level category, collapsed, in menu order', async () => {
    const shell = await renderShellFor(Role.system_admin);

    expect(visibleLabels(shell)).toEqual(['کنترل کیفیت', 'اطلاعات پایه', 'مدیریت سیستم']);
    for (const label of ['کنترل کیفیت', 'اطلاعات پایه', 'مدیریت سیستم']) {
      expect(categoryButton(shell, label).getAttribute('aria-expanded')).toBe('false');
    }
  });

  it('expands a category to show its children, nested categories included', async () => {
    const shell = await renderShellFor(Role.system_admin);

    categoryButton(shell, 'کنترل کیفیت').click();
    await settle();

    expect(categoryButton(shell, 'کنترل کیفیت').getAttribute('aria-expanded')).toBe('true');
    expect(visibleLabels(shell)).toEqual([
      'کنترل کیفیت',
      'آنالیز های روزانه',
      'آنالیز های استاندارد',
      'گزارشات',
      'اطلاعات پایه',
      'مدیریت سیستم',
    ]);

    categoryButton(shell, 'گزارشات').click();
    await settle();

    expect(visibleLabels(shell)).toContain('داشبورد روزانه');
  });

  it('collapses an expanded category again', async () => {
    const shell = await renderShellFor(Role.system_admin);

    categoryButton(shell, 'اطلاعات پایه').click();
    await settle();
    categoryButton(shell, 'اطلاعات پایه').click();
    await settle();

    expect(categoryButton(shell, 'اطلاعات پایه').getAttribute('aria-expanded')).toBe('false');
    expect(visibleLabels(shell)).not.toContain('محصولات');
  });

  // The disclosure button has to name what it shows and hides, or `aria-expanded` says "expanded"
  // about nothing in particular.
  it('points each category button at the group it controls', async () => {
    const shell = await renderShellFor(Role.system_admin);
    const button = categoryButton(shell, 'مدیریت سیستم');
    const group = shell.querySelector(`#${button.getAttribute('aria-controls')}`);

    expect(group?.textContent).toContain('کاربران');
  });

  it('withholds the system administration category from Management', async () => {
    const shell = await renderShellFor(Role.management);

    expect(visibleLabels(shell)).toEqual(['کنترل کیفیت', 'اطلاعات پایه']);
  });

  it('offers a Reporter only quality control', async () => {
    expect(visibleLabels(await renderShellFor(Role.reporter))).toEqual(['کنترل کیفیت']);
  });

  // Home is reachable through the brand instead; the drawer holds the tree and nothing else.
  it('lists no home entry in the drawer, and links the brand to home', async () => {
    const shell = await renderShellFor(Role.system_admin);
    const brand = shell.querySelector('mat-toolbar a');

    expect(shell.querySelector('nav a[href="/"]')).toBeNull();
    expect(brand?.getAttribute('href')).toBe('/');
    expect(brand?.textContent).toContain('کابلان');
  });

  it('opens the categories that hold the current page', async () => {
    const shell = await renderShellFor(Role.reporter, '/boms/dashboard');

    expect(categoryButton(shell, 'کنترل کیفیت').getAttribute('aria-expanded')).toBe('true');
    expect(categoryButton(shell, 'گزارشات').getAttribute('aria-expanded')).toBe('true');
    expect(visibleLabels(shell)).toContain('داشبورد روزانه');
  });

  // Colour alone cannot say "you are here" — `aria-current` is what carries it to a screen reader,
  // and Material's `activated` state is what carries it to everyone else. `/boms` is a prefix of
  // `/boms/dashboard`, so only exact matching keeps it from claiming the dashboard too.
  it('marks only the page the visitor is currently on', async () => {
    const shell = await renderShellFor(Role.reporter, '/boms/dashboard');
    const current = [...shell.querySelectorAll('nav a')].filter(
      (link) => link.getAttribute('aria-current') === 'page',
    );

    expect(current).toHaveLength(1);
    expect(current[0].textContent?.trim()).toBe('داشبورد روزانه');
  });

  it('navigates to a page when its entry is selected', async () => {
    const shell = await renderShellFor(Role.system_admin);

    categoryButton(shell, 'اطلاعات پایه').click();
    await settle();
    visibleEntries(shell)
      .find((entry) => entry.textContent?.trim() === 'محصولات')
      ?.click();
    await settle();

    expect(TestBed.inject(Router).url).toBe('/products');
  });

  // /login renders inside the shell too, and a drawer there would offer a signed-out visitor a
  // menu of pages that would only bounce them back.
  it('renders no navigation at all for an anonymous visitor', async () => {
    const shell = await renderShell();

    expect(shell.querySelector('nav')).toBeNull();
    expect(shell.querySelector('mat-toolbar')).toBeNull();
  });

  it('names the navigation landmark, so a screen reader can tell it from any other', async () => {
    const nav = (await renderShellFor(Role.reporter)).querySelector('nav');

    expect(nav?.getAttribute('aria-label')).toBeTruthy();
  });

  it('logs the user out and sends them to the login page', async () => {
    const shell = await renderShellFor(Role.system_admin);
    const logout = [...shell.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('خروج'),
    );

    logout?.click();
    // Navigation is asynchronous; `router.url` still reads the old page until it settles.
    await settle();

    expect(session.isAuthenticated()).toBe(false);
    expect(TestBed.inject(Router).url).toBe('/login');
  });
});
