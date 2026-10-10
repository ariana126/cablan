import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ACCESS_TOKEN_STORAGE_KEY } from './access-token-storage-key';
import { SessionStore } from './session-store';
import { fakeAccessToken } from './testing/fake-access-token';

describe('SessionStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts anonymous when nothing is stored', () => {
    const session = TestBed.inject(SessionStore);

    expect(session.isAuthenticated()).toBe(false);
    expect(session.accessToken()).toBe('');
  });

  it('hydrates from a token stored by a previous visit, so a reload keeps you logged in', () => {
    localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, 'a-token-from-last-time');

    const session = TestBed.inject(SessionStore);

    expect(session.isAuthenticated()).toBe(true);
    expect(session.accessToken()).toBe('a-token-from-last-time');
  });

  it('stores a token both in memory and on disk', () => {
    const session = TestBed.inject(SessionStore);

    session.store('a-fresh-token');

    expect(session.accessToken()).toBe('a-fresh-token');
    expect(session.isAuthenticated()).toBe(true);
    expect(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBe('a-fresh-token');
  });

  it('clears the token from both, so a reload does not resurrect a logged-out session', () => {
    const session = TestBed.inject(SessionStore);
    session.store('a-fresh-token');

    session.clear();

    expect(session.accessToken()).toBe('');
    expect(session.isAuthenticated()).toBe(false);
    expect(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
  });

  describe('expiry', () => {
    it('keeps a stored token that has not expired yet', () => {
      const token = fakeAccessToken(3600);
      localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);

      const session = TestBed.inject(SessionStore);

      expect(session.isAuthenticated()).toBe(true);
      expect(session.accessToken()).toBe(token);
    });

    it('treats an expired token found on disk exactly like no token, and deletes it', () => {
      localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, fakeAccessToken(-60));

      const session = TestBed.inject(SessionStore);

      expect(session.isAuthenticated()).toBe(false);
      expect(session.accessToken()).toBe('');
      expect(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
    });

    it('drops a token that expired while it was held, once asked', () => {
      vi.useFakeTimers({ now: new Date('2026-10-10T08:00:00Z') });
      const session = TestBed.inject(SessionStore);
      session.store(fakeAccessToken(60));

      vi.setSystemTime(new Date('2026-10-10T08:05:00Z'));
      session.discardIfExpired();

      expect(session.isAuthenticated()).toBe(false);
      expect(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
    });

    it('leaves a token that is still live alone when asked', () => {
      const session = TestBed.inject(SessionStore);
      const token = fakeAccessToken(3600);
      session.store(token);

      session.discardIfExpired();

      expect(session.accessToken()).toBe(token);
    });

    // An unreadable token is not proof of expiry: the API is the one that verifies tokens, and the
    // first call it rejects ends the session through the interceptor's 401 handling.
    it('leaves a token whose expiry it cannot read to the API to judge', () => {
      const session = TestBed.inject(SessionStore);
      session.store('not-a-jwt');

      session.discardIfExpired();

      expect(session.accessToken()).toBe('not-a-jwt');
    });
  });
});
