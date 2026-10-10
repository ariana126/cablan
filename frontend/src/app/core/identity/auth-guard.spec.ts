import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  GuardResult,
  MaybeAsync,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Role } from '../../api/model';
import { accessTokenInterceptor } from '../http/access-token-interceptor';
import { ACCESS_TOKEN_STORAGE_KEY } from './access-token-storage-key';
import { authGuard } from './auth-guard';
import { SessionStore } from './session-store';
import { fakeAccessToken } from './testing/fake-access-token';

@Component({ template: '<p>stub</p>' })
class StubPage {}

/** Runs the guard the way the router would, in an injection context. */
function runGuard(url: string): Promise<GuardResult> {
  const route = new ActivatedRouteSnapshot();
  const state = { url } as RouterStateSnapshot;

  return Promise.resolve(
    TestBed.runInInjectionContext(() => authGuard(route, state)) as MaybeAsync<GuardResult>,
  ) as Promise<GuardResult>;
}

describe('authGuard', () => {
  let session: SessionStore;
  let router: Router;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([accessTokenInterceptor])),
        provideHttpClientTesting(),
        provideRouter([{ path: 'login', component: StubPage }]),
      ],
    });

    session = TestBed.inject(SessionStore);
    router = TestBed.inject(Router);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  /** Yields until the guard has reached its `GET /api/users/me`, then answers it. */
  async function answerMe(response: { status: number; body?: object }): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    const request = httpMock.expectOne({ method: 'GET', url: '/api/users/me' });

    if (response.status === 200) {
      request.flush(response.body ?? {});
    } else {
      request.flush(null, { status: response.status, statusText: 'Unauthorized' });
    }
  }

  function expectLoginRedirect(result: GuardResult, returnUrl: string): void {
    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe(
      `/login?returnUrl=${encodeURIComponent(returnUrl)}`,
    );
  }

  it('lets a visitor with a live session through', async () => {
    session.store(fakeAccessToken(3600));

    const result = runGuard('/profile');
    await answerMe({
      status: 200,
      body: { id: '1', name: 'Sina Ghadrdan', username: 'sina.q', role: Role.reporter },
    });

    expect(await result).toBe(true);
  });

  it('redirects an anonymous visitor to log in, remembering where they were headed', async () => {
    expectLoginRedirect(await runGuard('/profile'), '/profile');
  });

  it('redirects once the session has been cleared', async () => {
    session.store(fakeAccessToken(3600));
    session.clear();

    expect(await runGuard('/profile')).toBeInstanceOf(UrlTree);
  });

  it('treats an expired token like no token — redirects, and deletes it without asking the API', async () => {
    session.store(fakeAccessToken(-60));

    expectLoginRedirect(await runGuard('/profile'), '/profile');
    expect(session.isAuthenticated()).toBe(false);
    expect(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
    httpMock.expectNone('/api/users/me');
  });

  // A forged, revoked or otherwise unverifiable token looks fine to the client; only the API can
  // tell, so the guard asks before it lets anything render.
  it('redirects when the API rejects the token, and ends the session', async () => {
    session.store('a-token-the-api-will-reject');

    const result = runGuard('/profile');
    await answerMe({ status: 401 });

    expectLoginRedirect(await result, '/profile');
    expect(session.isAuthenticated()).toBe(false);
  });
});
