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

  async function renderShellFor(
    role: Role,
    url = '/',
    name = 'Sina Ghadrdan',
  ): Promise<HTMLElement> {
    session.store(fakeAccessToken());
    const pending = TestBed.inject(CurrentUserStore).load();
    httpMock
      .expectOne({ method: 'GET', url: '/api/users/me' })
      .flush({ id: '1', name, username: 'sina.q', role });
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

    expect(visibleLabels(shell)).toEqual(['کنترل کیفیت', 'فنی', 'اطلاعات پایه', 'مدیریت سیستم']);
    for (const label of ['کنترل کیفیت', 'فنی', 'اطلاعات پایه', 'مدیریت سیستم']) {
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
      'فنی',
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

  describe('the toolbar', () => {
    it('shows the app wordmark as a link home', async () => {
      const shell = await renderShellFor(Role.system_admin);

      const brand = shell.querySelector('mat-toolbar a.brand');
      expect(brand?.textContent?.trim()).toBe('کابلان');
      expect(brand?.getAttribute('href')).toBe('/');
    });

    function breadcrumb(shell: HTMLElement): HTMLElement | null {
      return shell.querySelector<HTMLElement>('mat-toolbar nav[aria-label="مسیر"]');
    }

    function crumbLabels(shell: HTMLElement): (string | undefined)[] {
      return [...(breadcrumb(shell)?.querySelectorAll('li') ?? [])].map((item) =>
        item.textContent?.trim(),
      );
    }

    function crumbLink(shell: HTMLElement, label: string): HTMLAnchorElement {
      const link = [...(breadcrumb(shell)?.querySelectorAll<HTMLAnchorElement>('a') ?? [])].find(
        (candidate) => candidate.textContent?.trim() === label,
      );
      if (link === undefined) {
        throw new Error(`no breadcrumb link "${label}"`);
      }
      return link;
    }

    it('shows the way from home down the tree to the current page as a breadcrumb', async () => {
      const shell = await renderShellFor(Role.system_admin, '/boms/dashboard');

      expect(crumbLabels(shell)).toEqual([
        'صفحهٔ اصلی',
        'کنترل کیفیت',
        'گزارشات',
        'داشبورد روزانه',
      ]);
      expect(breadcrumb(shell)?.querySelector('[aria-current="page"]')?.textContent?.trim()).toBe(
        'داشبورد روزانه',
      );
    });

    it('links home and every category above the current page to its level', async () => {
      const shell = await renderShellFor(Role.system_admin, '/boms/dashboard');

      expect(crumbLink(shell, 'صفحهٔ اصلی').getAttribute('href')).toBe('/');
      expect(crumbLink(shell, 'کنترل کیفیت').getAttribute('href')).toBe(
        '/?category=quality-control',
      );
      expect(crumbLink(shell, 'گزارشات').getAttribute('href')).toBe('/?category=reports');
    });

    it('shows the way from home to the category on show at a level of home', async () => {
      const shell = await renderShellFor(Role.system_admin, '/?category=quality-control');

      expect(crumbLabels(shell)).toEqual(['صفحهٔ اصلی', 'کنترل کیفیت']);
      expect(breadcrumb(shell)?.querySelector('[aria-current="page"]')?.textContent?.trim()).toBe(
        'کنترل کیفیت',
      );
    });

    // Moving between levels of home changes only the query, not the route.
    it('follows the visitor between levels of home', async () => {
      const shell = await renderShellFor(Role.system_admin, '/?category=reports');
      expect(crumbLabels(shell)).toEqual(['صفحهٔ اصلی', 'کنترل کیفیت', 'گزارشات']);

      crumbLink(shell, 'کنترل کیفیت').click();
      await settle();
      expect(TestBed.inject(Router).url).toBe('/?category=quality-control');
      expect(crumbLabels(shell)).toEqual(['صفحهٔ اصلی', 'کنترل کیفیت']);

      crumbLink(shell, 'صفحهٔ اصلی').click();
      await settle();
      expect(TestBed.inject(Router).url).toBe('/');
      expect(breadcrumb(shell)).toBeNull();
    });

    it('shows no breadcrumb at the top level of home', async () => {
      const shell = await renderShellFor(Role.system_admin, '/');

      expect(breadcrumb(shell)).toBeNull();
    });

    // A withheld category falls back to the top level on home, so it must here too.
    it('shows no breadcrumb for a category the role cannot see', async () => {
      const shell = await renderShellFor(Role.reporter, '/?category=system-administration');

      expect(breadcrumb(shell)).toBeNull();
    });

    it('names the account button after the person and their role', async () => {
      const shell = await renderShellFor(Role.system_admin);

      const account = shell.querySelector('mat-toolbar button[aria-haspopup="menu"]');
      expect(account?.getAttribute('aria-label')).toBe('حساب کاربری: Sina Ghadrdan، مدیر سیستم');
    });

    it('shows the initials of the first two words of the name on the avatar', async () => {
      const shell = await renderShellFor(Role.reporter, '/', 'مریم احمدی');

      expect(shell.querySelector('.avatar')?.textContent?.trim()).toBe('م\u200cا');
    });

    it('keeps logging out behind the account menu rather than as a bare toolbar button', async () => {
      const shell = await renderShellFor(Role.system_admin);

      const bareLogout = [...shell.querySelectorAll('mat-toolbar button')].find((button) =>
        button.textContent?.includes('خروج'),
      );
      expect(bareLogout).toBeUndefined();
    });
  });

  it('logs the user out through the account menu and sends them to the login page', async () => {
    const shell = await renderShellFor(Role.system_admin);

    shell.querySelector<HTMLButtonElement>('mat-toolbar button[aria-haspopup="menu"]')?.click();
    await settle();
    const logout = [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
      (item) => item.textContent?.includes('خروج از سیستم'),
    );
    logout?.click();
    // Navigation is asynchronous; `router.url` still reads the old page until it settles.
    await settle();

    expect(session.isAuthenticated()).toBe(false);
    expect(TestBed.inject(Router).url).toBe('/login');
  });

  // jsdom has no media queries, so the shell sees a narrow viewport: the drawer floats over the page.
  describe('the floating drawer on a narrow viewport', () => {
    function menuButton(shell: HTMLElement): HTMLButtonElement {
      return shell.querySelector<HTMLButtonElement>(
        'mat-toolbar button[aria-controls="app-drawer"]',
      )!;
    }

    it('starts closed and opens from the menu button', async () => {
      const shell = await renderShellFor(Role.system_admin);

      expect(menuButton(shell).getAttribute('aria-expanded')).toBe('false');
      menuButton(shell).click();
      await settle();

      expect(menuButton(shell).getAttribute('aria-expanded')).toBe('true');
    });

    it('closes on Escape, and the menu button says so', async () => {
      const shell = await renderShellFor(Role.system_admin);
      menuButton(shell).click();
      await settle();

      shell
        .querySelector('mat-sidenav')
        ?.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }),
        );
      await settle();

      expect(menuButton(shell).getAttribute('aria-expanded')).toBe('false');
    });

    it('returns focus to the menu button when it closes', async () => {
      const shell = await renderShellFor(Role.system_admin);
      menuButton(shell).focus();
      menuButton(shell).click();
      await settle();

      shell
        .querySelector('mat-sidenav')
        ?.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }),
        );
      await settle();

      expect(document.activeElement).toBe(menuButton(shell));
    });

    it('closes when the scrim is pressed', async () => {
      const shell = await renderShellFor(Role.system_admin);
      menuButton(shell).click();
      await settle();

      shell.querySelector<HTMLElement>('.mat-drawer-backdrop')?.click();
      await settle();

      expect(menuButton(shell).getAttribute('aria-expanded')).toBe('false');
    });

    it('closes after a page is chosen, so it does not cover the page just opened', async () => {
      const shell = await renderShellFor(Role.system_admin);
      menuButton(shell).click();
      await settle();
      categoryButton(shell, 'اطلاعات پایه').click();
      await settle();

      visibleEntries(shell)
        .find((entry) => entry.textContent?.trim() === 'محصولات')
        ?.click();
      await settle();

      expect(menuButton(shell).getAttribute('aria-expanded')).toBe('false');
    });
  });
});
