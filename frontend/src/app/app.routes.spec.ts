import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Role } from './api/model';
import { routes } from './app.routes';
import { accessTokenInterceptor } from './core/http/access-token-interceptor';
import { ACCESS_TOKEN_STORAGE_KEY } from './core/identity/access-token-storage-key';
import { SessionStore } from './core/identity/session-store';
import { fakeAccessToken } from './core/identity/testing/fake-access-token';
import { LoginPage } from './features/login/login-page';
import { NotFoundPage } from './features/not-found/not-found-page';

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
        provideRouter(routes),
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    httpMock.verify();
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
      session.store(fakeAccessToken(-60));
      const harness = await RouterTestingHarness.create();

      await harness.navigateByUrl('/no-such-page');

      expect(router.url).toBe('/login?returnUrl=%2Fno-such-page');
      expect(session.isAuthenticated()).toBe(false);
      expect(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
    });
  });

  describe('with a token the API rejects', () => {
    it.each(['/no-such-page', '/users'])('sends %s to log in and ends the session', async (url) => {
      session.store('a-token-the-api-will-reject');
      const harness = await RouterTestingHarness.create('/login');

      await visit(harness, url, 'unauthorized');

      expect(router.url).toBe(`/login?returnUrl=${encodeURIComponent(url)}`);
      expect(harness.routeDebugElement?.componentInstance).toBeInstanceOf(LoginPage);
      expect(session.isAuthenticated()).toBe(false);
    });

    // The interceptor sees this 401 first, mid-navigation, while `router.url` still names the page
    // being left. The redirect must still remember where the visitor was headed, not where they were.
    it('remembers the destination, not the page being left, when the rejection comes mid-visit', async () => {
      session.store(fakeAccessToken(3600));
      const harness = await RouterTestingHarness.create('/login');
      await visit(harness, '/no-such-page', { role: Role.system_admin });

      session.store('a-token-the-api-will-reject');
      await visit(harness, '/users', 'unauthorized');

      expect(router.url).toBe('/login?returnUrl=%2Fusers');
      expect(harness.routeDebugElement?.componentInstance).toBeInstanceOf(LoginPage);
      expect(session.isAuthenticated()).toBe(false);
    });
  });

  describe('with a valid session', () => {
    it('renders the not-found page in place for an unknown path', async () => {
      session.store(fakeAccessToken(3600));
      const harness = await RouterTestingHarness.create('/login');

      await visit(harness, '/no-such-page', { role: Role.system_admin });

      expect(router.url).toBe('/no-such-page');
      expect(harness.routeDebugElement?.componentInstance).toBeInstanceOf(NotFoundPage);
    });

    it('renders the not-found page in place for a page the role cannot reach', async () => {
      session.store(fakeAccessToken(3600));
      const harness = await RouterTestingHarness.create('/login');

      await visit(harness, '/users', { role: Role.reporter });

      expect(router.url).toBe('/users');
      expect(harness.routeDebugElement?.componentInstance).toBeInstanceOf(NotFoundPage);
    });
  });
});
