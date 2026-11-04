import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Role } from '../../../api/model';
import { CurrentUserStore } from '../current-user-store';
import { SessionStore } from '../session-store';
import { fakeAccessToken } from './fake-access-token';

/**
 * Signs a spec's visitor in as `role` the way `guardedRoute` does — a live token, then
 * `GET /api/users/me` flushed — so whatever reads `CurrentUserStore.role()` sees it. Needs
 * `provideHttpClient()` and `provideHttpClientTesting()` in the TestBed, and `localStorage.clear()`
 * in `beforeEach` (the session survives in it).
 */
export async function signInAs(role: Role, httpMock: HttpTestingController): Promise<void> {
  TestBed.inject(SessionStore).store(fakeAccessToken());
  const loaded = TestBed.inject(CurrentUserStore).load();
  httpMock
    .expectOne({ method: 'GET', url: '/api/users/me' })
    .flush({ id: 'u1', name: 'سینا', username: 'sina', role });
  await loaded;
}
