import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Role } from '../../api/model';
import { CurrentUserStore } from './current-user-store';
import { SessionStore } from './session-store';

describe('CurrentUserStore', () => {
  let store: CurrentUserStore;
  let session: SessionStore;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    store = TestBed.inject(CurrentUserStore);
    session = TestBed.inject(SessionStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function flushMe(role: Role): void {
    httpMock
      .expectOne({ method: 'GET', url: '/api/users/me' })
      .flush({ id: '1', name: 'Sina Ghadrdan', username: 'sina.q', role });
  }

  it('resolves the signed-in user and exposes their role', async () => {
    session.store('a-valid-token');

    const pending = store.load();
    flushMe(Role.management);
    await pending;

    expect(store.role()).toBe(Role.management);
    expect(store.user()?.name).toBe('Sina Ghadrdan');
  });

  it('fetches once and reuses the answer', async () => {
    session.store('a-valid-token');

    const first = store.load();
    flushMe(Role.reporter);
    await first;

    await store.load();

    // `httpMock.verify()` in afterEach would fail on a second outstanding request; the point here
    // is that no second request was made at all.
    httpMock.expectNone({ method: 'GET', url: '/api/users/me' });
    expect(store.role()).toBe(Role.reporter);
  });

  it('reports no role for an anonymous visitor, without calling the API', async () => {
    await store.load();

    httpMock.expectNone({ method: 'GET', url: '/api/users/me' });
    expect(store.role()).toBeNull();
  });

  it('reports no role when the call fails, rather than rejecting', async () => {
    session.store('a-valid-token');

    const pending = store.load();
    httpMock
      .expectOne({ method: 'GET', url: '/api/users/me' })
      .flush(null, { status: 500, statusText: 'Server Error' });

    await expect(pending).resolves.toBeNull();
    expect(store.role()).toBeNull();
  });

  // Without this, the next person to sign in on the same tab inherits the previous one's menu.
  it('forgets the user on clear, and fetches again for the next session', async () => {
    session.store('a-valid-token');
    const first = store.load();
    flushMe(Role.system_admin);
    await first;

    store.clear();
    expect(store.role()).toBeNull();

    session.store('another-valid-token');
    const second = store.load();
    flushMe(Role.qc_inspector);
    await second;

    expect(store.role()).toBe(Role.qc_inspector);
  });
});
