import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ACCESS_TOKEN_STORAGE_KEY } from '../identity/access-token-storage-key';
import { SessionStore } from '../identity/session-store';
import { fakeAccessToken } from '../identity/testing/fake-access-token';
import { accessTokenInterceptor } from './access-token-interceptor';
import { anonymous } from './auth-context';

@Component({ template: '<p>stub</p>' })
class StubPage {}

describe('accessTokenInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let session: SessionStore;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([accessTokenInterceptor])),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'profile', component: StubPage },
          { path: 'login', component: StubPage },
        ]),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('attaching the token', () => {
    it('attaches it to an API request when there is one', () => {
      session.store('a-valid-token');

      http.get('/api/users/me').subscribe();

      const request = httpMock.expectOne('/api/users/me');
      expect(request.request.headers.get('Authorization')).toBe('Bearer a-valid-token');
      request.flush({});
    });

    it('attaches nothing when the session is anonymous', () => {
      http.get('/api/users/me').subscribe();

      const request = httpMock.expectOne('/api/users/me');
      expect(request.request.headers.has('Authorization')).toBe(false);
      request.flush({});
    });

    it('attaches nothing to a request marked anonymous, even holding a token', () => {
      // This is what keeps the token off `POST /api/auth/login` and `POST /api/users`.
      session.store('a-valid-token');

      http.post('/api/auth/login', {}, { context: anonymous() }).subscribe();

      const request = httpMock.expectOne('/api/auth/login');
      expect(request.request.headers.has('Authorization')).toBe(false);
      request.flush({ accessToken: 'another-token' });
    });

    it('drops an expired token instead of sending it', () => {
      session.store(fakeAccessToken(-60));

      http.get('/api/users/me').subscribe();

      const request = httpMock.expectOne('/api/users/me');
      expect(request.request.headers.has('Authorization')).toBe(false);
      expect(session.isAuthenticated()).toBe(false);
      expect(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
      request.flush({});
    });

    it('never sends the token off to a non-API URL', () => {
      session.store('a-valid-token');

      http.get('/assets/config.json').subscribe();

      const request = httpMock.expectOne('/assets/config.json');
      expect(request.request.headers.has('Authorization')).toBe(false);
      request.flush({});
    });
  });

  describe('when the API rejects the token', () => {
    it('clears the session and sends the user to log in, remembering where they were', async () => {
      session.store('an-expired-token');
      const harness = await RouterTestingHarness.create('/profile');

      http.get('/api/users/me').subscribe({ error: () => undefined });
      httpMock
        .expectOne('/api/users/me')
        .flush(
          { type: 'about:blank', title: 'Unauthorized', status: 401 },
          { status: 401, statusText: 'Unauthorized' },
        );
      // The interceptor's redirect is a navigation kicked off inside an error callback; let it settle.
      await harness.fixture.whenStable();

      expect(session.isAuthenticated()).toBe(false);
      expect(router.url).toBe('/login?returnUrl=%2Fprofile');
    });

    it('leaves an anonymous request alone — a failed login must not look like an expired session', async () => {
      // A 401 from `POST /api/auth/login` means "wrong password", not "your token died". The request
      // skipped the interceptor's error handling entirely, which is why no second status check is
      // needed to tell the two apart.
      session.store('a-valid-token');
      await RouterTestingHarness.create('/profile');

      http.post('/api/auth/login', {}, { context: anonymous() }).subscribe({
        error: () => undefined,
      });
      httpMock
        .expectOne('/api/auth/login')
        .flush(
          { type: 'https://my-api-doc.dev/problems/invalid-credentials' },
          { status: 401, statusText: 'Unauthorized' },
        );

      expect(session.isAuthenticated()).toBe(true);
      expect(router.url).toBe('/profile');
    });

    it('sends a visitor whose token expired on the page to log in, at their next API call', async () => {
      session.store(fakeAccessToken(-60));
      const harness = await RouterTestingHarness.create('/profile');

      http.get('/api/users/me').subscribe({ error: () => undefined });
      httpMock.expectOne('/api/users/me').flush(null, { status: 401, statusText: 'Unauthorized' });
      await harness.fixture.whenStable();

      expect(router.url).toBe('/login?returnUrl=%2Fprofile');
    });

    it('keeps a token that arrived while the rejected request was in flight', async () => {
      // The 401 judged the token that was sent — none — not the one a login stored in between.
      const harness = await RouterTestingHarness.create('/profile');

      http.get('/api/users/me').subscribe({ error: () => undefined });
      session.store('a-token-from-a-login-in-between');
      httpMock.expectOne('/api/users/me').flush(null, { status: 401, statusText: 'Unauthorized' });
      await harness.fixture.whenStable();

      expect(session.accessToken()).toBe('a-token-from-a-login-in-between');
      expect(router.url).toBe('/profile');
    });

    it('does not redirect to login from login, which would nest returnUrl into itself', async () => {
      session.store('an-expired-token');
      await RouterTestingHarness.create('/login');

      http.get('/api/users/me').subscribe({ error: () => undefined });
      httpMock.expectOne('/api/users/me').flush(null, { status: 401, statusText: 'Unauthorized' });

      expect(session.isAuthenticated()).toBe(false);
      expect(router.url).toBe('/login');
    });

    it('rethrows the failure so the caller still decides what the user sees', () => {
      session.store('an-expired-token');
      let seen: unknown;

      http.get('/api/users/me').subscribe({ error: (error: unknown) => (seen = error) });
      httpMock.expectOne('/api/users/me').flush(null, { status: 401, statusText: 'Unauthorized' });

      expect(seen).toBeDefined();
    });

    it('closes any open dialog, so an expired session mid-dialog does not leave a stuck overlay on top of the login page', async () => {
      // Asserted as a call to `closeAll()`, not the eventual `openDialogs.length` — a real dialog
      // close is animation-driven, and jsdom never fires the `transitionend` that drives it. What
      // this interceptor owns is *asking* the dialog to close; whether the CSS transition genuinely
      // finishes is Material's concern, not this unit's.
      session.store('an-expired-token');
      const harness = await RouterTestingHarness.create('/profile');
      const dialog = TestBed.inject(MatDialog);
      const closeAllSpy = vi.spyOn(dialog, 'closeAll');

      http.get('/api/users/me').subscribe({ error: () => undefined });
      httpMock.expectOne('/api/users/me').flush(null, { status: 401, statusText: 'Unauthorized' });
      await harness.fixture.whenStable();

      expect(closeAllSpy).toHaveBeenCalledOnce();
    });
  });
});
