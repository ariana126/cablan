import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Role } from './api/model';
import { routes } from './app.routes';
import { accessTokenInterceptor } from './core/http/access-token-interceptor';
import { ACCESS_TOKEN_STORAGE_KEY } from './core/identity/access-token-storage-key';
import { SessionStore } from './core/identity/session-store';
import { moveClock } from './core/identity/testing/clock';
import { fakeAccessToken } from './core/identity/testing/fake-access-token';
import { LoginPage } from './features/login/login-page';
import { NotFoundPage } from './features/not-found/not-found-page';
import { OrdersPage } from './features/orders/orders-page';
import { PmDashboardPage } from './features/pm-dashboard/pm-dashboard-page';
import { EquipmentFolderPage } from './features/pm-plans/equipment-folder-page';
import { DailyPmSchedulePage } from './features/pm-schedule/daily-pm-schedule-page';
import { PmOverviewPage } from './features/pm-schedule/pm-overview-page';

/**
 * The route table as a whole, seen from outside: what a visitor lands on for a given URL and
 * session. The property under test is that someone without a valid session cannot tell an existing
 * page from a missing one — every URL sends them to log in, alike.
 */
describe('routes', () => {
  let httpMock: HttpTestingController;
  let session: SessionStore;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([accessTokenInterceptor])),
        provideHttpClientTesting(),
        // As `app.config.ts` does: route params arrive as the pages' inputs.
        provideRouter(routes, withComponentInputBinding()),
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    httpMock.verify();
    vi.useRealTimers();
  });

  /** Navigates, answering the one `GET /api/users/me` the navigation makes, then lets it settle. */
  async function visit(
    harness: RouterTestingHarness,
    url: string,
    me: { role: Role } | 'unauthorized',
  ): Promise<void> {
    const navigation = harness.navigateByUrl(url);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const request = httpMock.expectOne({ method: 'GET', url: '/api/users/me' });

    if (me === 'unauthorized') {
      request.flush(null, { status: 401, statusText: 'Unauthorized' });
    } else {
      request.flush({ id: '1', name: 'Sina Ghadrdan', username: 'sina.q', role: me.role });
    }

    await navigation;
    await harness.fixture.whenStable();
  }

  describe('without a session', () => {
    it.each(['/no-such-page', '/users', '/'])('sends %s to log in', async (url) => {
      const harness = await RouterTestingHarness.create();

      await harness.navigateByUrl(url);

      expect(router.url).toBe(`/login?returnUrl=${encodeURIComponent(url)}`);
      expect(harness.routeDebugElement?.componentInstance).toBeInstanceOf(LoginPage);
    });
  });

  describe('with an expired token', () => {
    // Seeded through the store: `SessionStore` was already constructed in `beforeEach`, so a token
    // written straight to `localStorage` now would never be seen. Reading an expired token off disk
    // at start-up is `session-store.spec.ts`'s to prove.
    it('sends an unknown path to log in and deletes the token', async () => {
      session.store(fakeAccessToken({ lifetimeSeconds: 3600 }));
      moveClock(3600);
      const harness = await RouterTestingHarness.create();

      await harness.navigateByUrl('/no-such-page');

      expect(router.url).toBe('/login?returnUrl=%2Fno-such-page');
      expect(session.isAuthenticated()).toBe(false);
      expect(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
    });
  });

  describe('with a token the API rejects', () => {
    it.each(['/no-such-page', '/users'])('sends %s to log in and ends the session', async (url) => {
      session.store(fakeAccessToken());
      const harness = await RouterTestingHarness.create('/login');

      await visit(harness, url, 'unauthorized');

      expect(router.url).toBe(`/login?returnUrl=${encodeURIComponent(url)}`);
      expect(harness.routeDebugElement?.componentInstance).toBeInstanceOf(LoginPage);
      expect(session.isAuthenticated()).toBe(false);
    });

    // The interceptor sees this 401 first, mid-navigation, while `router.url` still names the page
    // being left. The redirect must still remember where the visitor was headed, not where they were.
    it('remembers the destination, not the page being left, when the rejection comes mid-visit', async () => {
      session.store(fakeAccessToken());
      const harness = await RouterTestingHarness.create('/login');
      await visit(harness, '/no-such-page', { role: Role.system_admin });

      session.store(fakeAccessToken({ subject: '2' }));
      await visit(harness, '/users', 'unauthorized');

      expect(router.url).toBe('/login?returnUrl=%2Fusers');
      expect(harness.routeDebugElement?.componentInstance).toBeInstanceOf(LoginPage);
      expect(session.isAuthenticated()).toBe(false);
    });
  });

  describe('with a valid session', () => {
    it('renders the not-found page in place for an unknown path', async () => {
      session.store(fakeAccessToken());
      const harness = await RouterTestingHarness.create('/login');

      await visit(harness, '/no-such-page', { role: Role.system_admin });

      expect(router.url).toBe('/no-such-page');
      expect(harness.routeDebugElement?.componentInstance).toBeInstanceOf(NotFoundPage);
    });

    it('renders the not-found page in place for a page the role cannot reach', async () => {
      session.store(fakeAccessToken());
      const harness = await RouterTestingHarness.create('/login');

      await visit(harness, '/users', { role: Role.reporter });

      expect(router.url).toBe('/users');
      expect(harness.routeDebugElement?.componentInstance).toBeInstanceOf(NotFoundPage);
    });

    // Issue #101: every production role reads the orders; the maintenance roles reach none.
    it('renders «سفارشات» for a Reporter', async () => {
      session.store(fakeAccessToken());
      const harness = await RouterTestingHarness.create('/login');

      const navigation = harness.navigateByUrl('/orders');
      await new Promise((resolve) => setTimeout(resolve, 0));
      httpMock
        .expectOne({ method: 'GET', url: '/api/users/me' })
        .flush({ id: '1', name: 'سینا', username: 'sina', role: Role.reporter });
      await navigation;
      httpMock.expectOne({ method: 'GET', url: '/api/orders' }).flush({ items: [] });
      await harness.fixture.whenStable();

      expect(harness.routeDebugElement?.componentInstance).toBeInstanceOf(OrdersPage);
      expect(TestBed.inject(Title).getTitle()).toBe('سفارشات · کابلان');
    });

    it('renders the daily PM list for a PM Inspector', async () => {
      session.store(fakeAccessToken());
      const harness = await RouterTestingHarness.create('/login');

      // Not `visit()`: the page's own read keeps it from settling until it is answered.
      const navigation = harness.navigateByUrl('/pm-schedule/daily');
      await new Promise((resolve) => setTimeout(resolve, 0));
      httpMock
        .expectOne({ method: 'GET', url: '/api/users/me' })
        .flush({ id: '1', name: 'مسلمی', username: 'moslemi', role: Role.pm_inspector });
      await navigation;
      httpMock.expectOne({ method: 'GET', url: '/api/pm-schedule/daily' }).flush([]);
      await harness.fixture.whenStable();

      expect(harness.routeDebugElement?.componentInstance).toBeInstanceOf(DailyPmSchedulePage);
      expect(TestBed.inject(Title).getTitle()).toBe('برنامه روزانه PM · کابلان');
    });

    it('renders «برنامه PM» for a PM Inspector, titled by its new name', async () => {
      session.store(fakeAccessToken());
      const harness = await RouterTestingHarness.create('/login');

      const navigation = harness.navigateByUrl('/pm-schedule/overview');
      await new Promise((resolve) => setTimeout(resolve, 0));
      httpMock
        .expectOne({ method: 'GET', url: '/api/users/me' })
        .flush({ id: '1', name: 'مسلمی', username: 'moslemi', role: Role.pm_inspector });
      await navigation;
      httpMock.expectOne({ method: 'GET', url: '/api/pm-schedule/filter-options' }).flush({});
      httpMock.expectOne((request) => request.url === '/api/pm-schedule/calendar').flush([]);
      await harness.fixture.whenStable();

      expect(harness.routeDebugElement?.componentInstance).toBeInstanceOf(PmOverviewPage);
      expect(TestBed.inject(Title).getTitle()).toBe('برنامه PM · کابلان');
    });

    // Issue #89: the technical management dashboard, for the planners only.
    it('renders «داشبورد مدیریتی فنی» for a Technical Manager', async () => {
      session.store(fakeAccessToken());
      const harness = await RouterTestingHarness.create('/login');

      const navigation = harness.navigateByUrl('/pm-dashboard');
      await new Promise((resolve) => setTimeout(resolve, 0));
      httpMock
        .expectOne({ method: 'GET', url: '/api/users/me' })
        .flush({ id: '1', name: 'فنی', username: 'tm', role: Role.technical_manager });
      await navigation;
      await new Promise((resolve) => setTimeout(resolve, 0));
      TestBed.inject(ApplicationRef).tick();
      httpMock.match((request) => request.url.startsWith('/api/'));

      expect(harness.routeDebugElement?.componentInstance).toBeInstanceOf(PmDashboardPage);
      expect(TestBed.inject(Title).getTitle()).toBe('داشبورد مدیریتی فنی · کابلان');
    });

    it('withholds the technical management dashboard from a PM Inspector', async () => {
      session.store(fakeAccessToken());
      const harness = await RouterTestingHarness.create('/login');

      await visit(harness, '/pm-dashboard', { role: Role.pm_inspector });

      expect(router.url).toBe('/pm-dashboard');
      expect(harness.routeDebugElement?.componentInstance).toBeInstanceOf(NotFoundPage);
    });

    // The maintenance roles reach nothing outside maintenance.
    it('withholds the BOM pages from a PM Inspector', async () => {
      session.store(fakeAccessToken());
      const harness = await RouterTestingHarness.create('/login');

      await visit(harness, '/boms', { role: Role.pm_inspector });

      expect(harness.routeDebugElement?.componentInstance).toBeInstanceOf(NotFoundPage);
    });

    it('withholds the PM plans from a PM Inspector', async () => {
      session.store(fakeAccessToken());
      const harness = await RouterTestingHarness.create('/login');

      await visit(harness, '/pm-plans', { role: Role.pm_inspector });

      expect(harness.routeDebugElement?.componentInstance).toBeInstanceOf(NotFoundPage);
    });

    // Issue #92: each equipment's folder is a page of its own, under the board's rule.
    it('renders an equipment’s folder at /pm-plans/:equipmentId for a Technical Manager', async () => {
      session.store(fakeAccessToken());
      const harness = await RouterTestingHarness.create('/login');

      const navigation = harness.navigateByUrl('/pm-plans/e1');
      await new Promise((resolve) => setTimeout(resolve, 0));
      httpMock
        .expectOne({ method: 'GET', url: '/api/users/me' })
        .flush({ id: '1', name: 'فنی', username: 'tm', role: Role.technical_manager });
      await navigation;
      httpMock
        .expectOne({ method: 'GET', url: '/api/equipment/e1' })
        .flush({ id: 'e1', name: 'اکسترودر 1', retired: false, planItems: [] });
      // Not `whenStable()`: it would wait for the history read the folder's sections now start.
      await new Promise((resolve) => setTimeout(resolve, 0));
      TestBed.inject(ApplicationRef).tick();
      httpMock.expectOne({ method: 'GET', url: '/api/equipment/e1/maintenance-history' }).flush([]);
      await harness.fixture.whenStable();

      expect(harness.routeDebugElement?.componentInstance).toBeInstanceOf(EquipmentFolderPage);
      expect(TestBed.inject(Title).getTitle()).toBe('پرونده فنی تجهیز · کابلان');
      expect(harness.routeNativeElement?.querySelector('h1')?.textContent?.trim()).toBe(
        'اکسترودر 1',
      );
    });

    it('withholds an equipment’s folder from a PM Inspector', async () => {
      session.store(fakeAccessToken());
      const harness = await RouterTestingHarness.create('/login');

      await visit(harness, '/pm-plans/e1', { role: Role.pm_inspector });

      expect(router.url).toBe('/pm-plans/e1');
      expect(harness.routeDebugElement?.componentInstance).toBeInstanceOf(NotFoundPage);
    });
  });
});
