import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Role } from '../../api/model';
import { CurrentUserStore } from '../../core/identity/current-user-store';
import { SessionStore } from '../../core/identity/session-store';
import { AppShell } from './app-shell';

describe('AppShell', () => {
  let httpMock: HttpTestingController;
  let session: SessionStore;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // Real routes, so `routerLinkActive` has a navigation to compare against and
        // `navigateByUrl('/login')` resolves rather than failing to match.
        provideRouter([
          { path: '', children: [] },
          { path: 'login', children: [] },
        ]),
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
  });

  afterEach(() => {
    httpMock.verify();
  });

  async function renderShell(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(AppShell);
    // `routerLinkActive` only resolves once a navigation has happened; without this the router sits
    // at its initial state and no link is ever active.
    await TestBed.inject(Router).navigateByUrl('/');
    await fixture.whenStable();

    return fixture.nativeElement as HTMLElement;
  }

  async function renderShellFor(role: Role): Promise<HTMLElement> {
    session.store('a-valid-token');
    const pending = TestBed.inject(CurrentUserStore).load();
    httpMock
      .expectOne({ method: 'GET', url: '/api/users/me' })
      .flush({ id: '1', name: 'Sina Ghadrdan', username: 'sina.q', role });
    await pending;

    return renderShell();
  }

  function destinationLabels(shell: HTMLElement): string[] {
    return [...shell.querySelectorAll('nav a')].map((link) => link.textContent?.trim() ?? '');
  }

  it('offers a System Admin every destination, in the drawer order', async () => {
    expect(destinationLabels(await renderShellFor(Role.system_admin))).toEqual([
      'صفحهٔ اصلی',
      'داشبورد روزانه',
      'آنالیزهای روزانه',
      'آنالیزهای استاندارد',
      'رویدادهای سیستم',
      'محصولات',
      'اجزا',
      'مواد اولیه',
      'کاربران',
    ]);
  });

  it('withholds users and the audit log from Management', async () => {
    const labels = destinationLabels(await renderShellFor(Role.management));

    expect(labels).not.toContain('کاربران');
    expect(labels).not.toContain('رویدادهای سیستم');
    expect(labels).toContain('داشبورد روزانه');
  });

  it('offers a Reporter only the two BOM pages, plus home', async () => {
    expect(destinationLabels(await renderShellFor(Role.reporter))).toEqual([
      'صفحهٔ اصلی',
      'آنالیزهای روزانه',
      'آنالیزهای استاندارد',
    ]);
  });

  // /login renders inside the shell too, and a drawer there would offer a signed-out visitor a
  // menu of pages that would only bounce them back.
  it('renders no navigation at all for an anonymous visitor', async () => {
    const shell = await renderShell();

    expect(shell.querySelector('nav')).toBeNull();
    expect(shell.querySelector('mat-toolbar')).toBeNull();
  });

  // Colour alone cannot say "you are here" — `aria-current` is what carries it to a screen reader,
  // and Material's `activated` state is what carries it to everyone else.
  it('marks the destination the visitor is currently on', async () => {
    const shell = await renderShellFor(Role.reporter);
    const current = [...shell.querySelectorAll('nav a')].filter(
      (link) => link.getAttribute('aria-current') === 'page',
    );

    expect(current).toHaveLength(1);
    expect(current[0].textContent?.trim()).toBe('صفحهٔ اصلی');
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
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(session.isAuthenticated()).toBe(false);
    expect(TestBed.inject(Router).url).toBe('/login');
  });
});
