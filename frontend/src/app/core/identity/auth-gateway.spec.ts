import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { accessTokenInterceptor } from '../http/access-token-interceptor';
import { AuthGateway } from './auth-gateway';
import { SessionStore } from './session-store';

describe('AuthGateway', () => {
  let gateway: AuthGateway;
  let session: SessionStore;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();

    // The interceptor is wired in here, not just the plain HTTP client, because the point of the
    // second test below is that the gateway marks its own call `{ context: anonymous() }` — that
    // only shows up in the outgoing request once something actually reads the context.
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([accessTokenInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });

    gateway = TestBed.inject(AuthGateway);
    session = TestBed.inject(SessionStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('posts the credentials and stores the returned token', () => {
    let completed = false;
    gateway.login('sina.q', 'Passw0rd!').subscribe(() => (completed = true));

    const request = httpMock.expectOne('/api/auth/login');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ username: 'sina.q', password: 'Passw0rd!' });
    request.flush({ accessToken: 'a-fresh-token' });

    expect(completed).toBe(true);
    expect(session.accessToken()).toBe('a-fresh-token');
    expect(session.isAuthenticated()).toBe(true);
  });

  it('sends the login request without a bearer token, even when one is already stored', () => {
    session.store('a-stale-token');

    gateway.login('sina.q', 'Passw0rd!').subscribe();

    const request = httpMock.expectOne('/api/auth/login');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ accessToken: 'a-fresh-token' });
  });

  it('clears the session on logout', () => {
    session.store('a-token');

    gateway.logout();

    expect(session.isAuthenticated()).toBe(false);
    expect(session.accessToken()).toBe('');
  });

  it('leaves the session untouched and rethrows when the API rejects the credentials', () => {
    let seenError: unknown;
    gateway
      .login('sina.q', 'wrong-password')
      .subscribe({ error: (error: unknown) => (seenError = error) });

    httpMock
      .expectOne('/api/auth/login')
      .flush(
        { type: 'https://my-api-doc.dev/problems/invalid-credentials', status: 401 },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(seenError).toBeDefined();
    expect(session.isAuthenticated()).toBe(false);
  });
});
