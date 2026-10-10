import { computed, Injectable, Signal, signal } from '@angular/core';
import { jwtDecode } from 'jwt-decode';

import {
  ACCESS_TOKEN_RECEIVED_AT_STORAGE_KEY,
  ACCESS_TOKEN_STORAGE_KEY,
} from './access-token-storage-key';

/** The token, and when this browser received it, by this browser's own clock (epoch ms). */
interface HeldToken {
  readonly value: string;
  readonly receivedAt: number;
}

/**
 * Holds the bearer token for the current session.
 *
 * **The token lives in `localStorage`, and that is a real trade-off.** Any script running on this
 * origin can read it — an XSS anywhere in the app or in a dependency is a full account takeover, and
 * nothing on the client can mitigate that. It is here because the API issues a bearer token in a JSON
 * response body rather than setting a cookie, so the browser will not carry it for us. The price
 * bought is that a reload, or a second tab, keeps you logged in.
 *
 * If the API ever sets an `httpOnly`, `SameSite=Strict` cookie instead, delete this class outright
 * rather than adapting it — there would be nothing left for it to hold.
 *
 * **An expired token is no token — and expiry is judged on this browser's clock alone.** The JWT's
 * `exp` is a timestamp on the *server's* clock; comparing it with `Date.now()` would log out anyone
 * whose PC clock runs fast by more than the token's lifetime the moment they signed in. So the store
 * records when it received the token (persisted beside it, so a reload measures from the same
 * moment), reads the token's lifetime as `exp - iat` — a duration, which no clock skew distorts — and
 * counts it expired once that much local time has passed since receipt. A token whose lifetime or
 * receipt time cannot be read (not a JWT, a missing or malformed `iat`/`exp`, or one stored before
 * receipt times were recorded) cannot be judged live, so it counts as expired too.
 *
 * An expired token is dropped — from the signal and from `localStorage` — when the store is
 * constructed and whenever `discardIfExpired()` is asked, which the auth guard does on every
 * navigation and the interceptor on every API call. Anything that reads `isAuthenticated()`
 * therefore never mistakes a dead session for a live one for longer than it takes the next
 * navigation or request to happen. The claims are only read, never trusted: the signature is not
 * (and cannot be) checked here, so a token that *looks* live still has to get past the API, whose 401
 * ends the session through the interceptor. That is also the backstop for a local clock moved
 * *back* after receipt, which this check cannot see.
 *
 * Deliberate non-goal: there is no `storage` event listener, so logging out in one tab does not log
 * out the others. Adding one is easy; it is left out because nothing needs it yet.
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly held = signal<HeldToken | null>(readStoredToken());

  constructor() {
    this.discardIfExpired();
  }

  /** The empty string means anonymous — never `null`, so nothing downstream has to be nullable. */
  readonly accessToken: Signal<string> = computed(() => this.held()?.value ?? '');

  readonly isAuthenticated = computed(() => this.held() !== null);

  /** Starts a session with a token just received from the API; its lifetime runs from now. */
  store(accessToken: string): void {
    // Written synchronously rather than through an `effect()`: persisting is the point of the call,
    // not a derived consequence of it, and a synchronous write is deterministic in tests.
    const receivedAt = Date.now();
    localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
    localStorage.setItem(ACCESS_TOKEN_RECEIVED_AT_STORAGE_KEY, String(receivedAt));
    this.held.set({ value: accessToken, receivedAt });
  }

  clear(): void {
    localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    localStorage.removeItem(ACCESS_TOKEN_RECEIVED_AT_STORAGE_KEY);
    this.held.set(null);
  }

  /**
   * Ends the session unless its token is provably still live: received less than its lifetime
   * (`exp - iat`) ago, by this browser's clock. See the class comment for why `exp` itself is never
   * compared with `Date.now()`.
   */
  discardIfExpired(): void {
    const held = this.held();
    if (held !== null && !isLive(held, Date.now())) {
      this.clear();
    }
  }
}

function readStoredToken(): HeldToken | null {
  const value = localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  if (value === null) {
    return null;
  }

  // `Number('')` is 0, a perfectly finite epoch, so an empty value has to be ruled out by hand.
  const rawReceivedAt = localStorage.getItem(ACCESS_TOKEN_RECEIVED_AT_STORAGE_KEY) ?? '';
  const receivedAt = rawReceivedAt.trim() === '' ? NaN : Number(rawReceivedAt);

  return { value, receivedAt };
}

function isLive({ value, receivedAt }: HeldToken, now: number): boolean {
  const lifetime = lifetimeInMilliseconds(value);

  return lifetime !== null && Number.isFinite(receivedAt) && now - receivedAt < lifetime;
}

/** `exp - iat`, or `null` when the token does not carry a readable, positive pair of them. */
function lifetimeInMilliseconds(token: string): number | null {
  let claims: { iat?: unknown; exp?: unknown };
  try {
    claims = jwtDecode(token);
  } catch {
    return null;
  }

  const { iat, exp } = claims;
  if (!isFiniteNumber(iat) || !isFiniteNumber(exp) || exp <= iat) {
    return null;
  }

  return (exp - iat) * 1000;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
