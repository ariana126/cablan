import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACCESS_TOKEN_RECEIVED_AT_STORAGE_KEY,
  ACCESS_TOKEN_STORAGE_KEY,
} from './access-token-storage-key';
import { SessionStore } from './session-store';
import { moveClock } from './testing/clock';
import { fakeAccessToken, unsignedJwt } from './testing/fake-access-token';

const HOUR = 3600;

/** Seconds since the epoch, for a server-side `iat`. */
function epochSeconds(isoDate: string): number {
  return new Date(isoDate).getTime() / 1000;
}

/** What a previous visit would have left on disk. */
function leaveOnDisk(token: string, receivedAt: string | null): void {
  localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
  if (receivedAt !== null) {
    localStorage.setItem(ACCESS_TOKEN_RECEIVED_AT_STORAGE_KEY, receivedAt);
  }
}

describe('SessionStore', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-10T08:00:00Z') });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts anonymous when nothing is stored', () => {
    const sut = TestBed.inject(SessionStore);

    expect(sut.isAuthenticated()).toBe(false);
    expect(sut.accessToken()).toBe('');
  });

  it('stores a token both in memory and on disk', () => {
    const sut = TestBed.inject(SessionStore);
    const token = fakeAccessToken();

    sut.store(token);

    expect(sut.accessToken()).toBe(token);
    expect(sut.isAuthenticated()).toBe(true);
    expect(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBe(token);
  });

  it('clears the token from both, so a reload does not resurrect a logged-out session', () => {
    const sut = TestBed.inject(SessionStore);
    sut.store(fakeAccessToken());

    sut.clear();

    expect(sut.accessToken()).toBe('');
    expect(sut.isAuthenticated()).toBe(false);
    expect(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(ACCESS_TOKEN_RECEIVED_AT_STORAGE_KEY)).toBeNull();
  });

  // Expiry is measured on this browser's clock, from the moment the token arrived, for the token's
  // own lifetime (`exp - iat`). The server's timestamps are never compared with `Date.now()`, so a
  // PC whose clock is wrong — by minutes or by days — still gets the full session.
  describe('expiry', () => {
    it('keeps a fresh token even when the client clock runs days ahead of the server', () => {
      const sut = TestBed.inject(SessionStore);
      const token = fakeAccessToken({
        lifetimeSeconds: HOUR,
        issuedAt: epochSeconds('2026-10-07T08:00:00Z'),
      });
      sut.store(token);

      sut.discardIfExpired();

      expect(sut.accessToken()).toBe(token);
    });

    it('keeps a fresh token even when the client clock runs behind the server', () => {
      const sut = TestBed.inject(SessionStore);
      const token = fakeAccessToken({
        lifetimeSeconds: HOUR,
        issuedAt: epochSeconds('2026-10-12T08:00:00Z'),
      });
      sut.store(token);

      sut.discardIfExpired();

      expect(sut.accessToken()).toBe(token);
    });

    it('keeps the token until its lifetime has elapsed since it was received', () => {
      const sut = TestBed.inject(SessionStore);
      const token = fakeAccessToken({ lifetimeSeconds: HOUR });
      sut.store(token);
      moveClock(HOUR - 1);

      sut.discardIfExpired();

      expect(sut.accessToken()).toBe(token);
    });

    it('drops the token, from memory and disk, once its lifetime has elapsed since it was received', () => {
      const sut = TestBed.inject(SessionStore);
      sut.store(
        fakeAccessToken({ lifetimeSeconds: HOUR, issuedAt: epochSeconds('2026-10-07T08:00:00Z') }),
      );
      moveClock(HOUR);

      sut.discardIfExpired();

      expect(sut.isAuthenticated()).toBe(false);
      expect(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
      expect(localStorage.getItem(ACCESS_TOKEN_RECEIVED_AT_STORAGE_KEY)).toBeNull();
    });

    it.each([
      ['no iat', unsignedJwt({ sub: '1', exp: 2_000_000_000 })],
      ['no exp', unsignedJwt({ sub: '1', iat: 2_000_000_000 })],
      ['a non-numeric iat', unsignedJwt({ sub: '1', iat: 'yesterday', exp: 2_000_000_000 })],
      ['an exp before its iat', unsignedJwt({ sub: '1', iat: 2_000_000_000, exp: 1_999_999_000 })],
      ['no JWT at all', 'not-a-jwt'],
    ])('treats a token with %s as no session', (_case, token) => {
      const sut = TestBed.inject(SessionStore);
      sut.store(token);

      sut.discardIfExpired();

      expect(sut.isAuthenticated()).toBe(false);
      expect(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
    });
  });

  describe('after a reload', () => {
    it('picks up a live session where the previous visit left it', () => {
      const token = fakeAccessToken({
        lifetimeSeconds: HOUR,
        issuedAt: epochSeconds('2026-10-07T08:00:00Z'),
      });
      TestBed.inject(SessionStore).store(token);
      moveClock(HOUR / 2);
      TestBed.resetTestingModule();

      const sut = TestBed.inject(SessionStore);

      expect(sut.isAuthenticated()).toBe(true);
      expect(sut.accessToken()).toBe(token);
    });

    it('still measures the lifetime from the original receipt, not from the reload', () => {
      TestBed.inject(SessionStore).store(fakeAccessToken({ lifetimeSeconds: HOUR }));
      moveClock(HOUR / 2);
      TestBed.resetTestingModule();
      const sut = TestBed.inject(SessionStore);
      moveClock(HOUR / 2);

      sut.discardIfExpired();

      expect(sut.isAuthenticated()).toBe(false);
    });

    it('drops a session that expired while the app was closed', () => {
      leaveOnDisk(
        fakeAccessToken({ lifetimeSeconds: HOUR }),
        String(new Date('2026-10-10T06:59:59Z').getTime()),
      );

      const sut = TestBed.inject(SessionStore);

      expect(sut.isAuthenticated()).toBe(false);
      expect(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
    });

    // A token stored before receipt times were recorded has no clock to be measured against.
    it.each([
      ['missing', null],
      ['unreadable', 'last tuesday'],
      ['empty', ''],
    ])('drops a stored token whose receipt time is %s', (_case, receivedAt) => {
      leaveOnDisk(fakeAccessToken(), receivedAt);

      const sut = TestBed.inject(SessionStore);

      expect(sut.isAuthenticated()).toBe(false);
      expect(sut.accessToken()).toBe('');
      expect(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
      expect(localStorage.getItem(ACCESS_TOKEN_RECEIVED_AT_STORAGE_KEY)).toBeNull();
    });
  });
});
