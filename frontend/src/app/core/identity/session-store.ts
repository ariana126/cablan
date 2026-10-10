import { computed, Injectable, Signal, signal } from '@angular/core';
import { jwtDecode } from 'jwt-decode';

import { ACCESS_TOKEN_STORAGE_KEY } from './access-token-storage-key';

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
 * **An expired token is no token.** One whose JWT `exp` has passed is dropped — from the signal and
 * from `localStorage` — when the store is constructed and whenever `discardIfExpired()` is asked,
 * which the auth guard does on every navigation and the interceptor on every API call. Anything
 * that reads `isAuthenticated()` therefore never mistakes a dead session for a live one for longer
 * than it takes the next navigation or request to happen. Only `exp` is read, never trusted: the
 * signature is not (and cannot be) checked here, so a token that *looks* live still has to get past
 * the API, whose 401 ends the session through the interceptor.
 *
 * Deliberate non-goal: there is no `storage` event listener, so logging out in one tab does not log
 * out the others. Adding one is easy; it is left out because nothing needs it yet.
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly token = signal(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) ?? '');

  constructor() {
    this.discardIfExpired();
  }

  /** The empty string means anonymous — never `null`, so nothing downstream has to be nullable. */
  readonly accessToken: Signal<string> = this.token.asReadonly();

  readonly isAuthenticated = computed(() => this.token() !== '');

  store(accessToken: string): void {
    // Written synchronously rather than through an `effect()`: persisting is the point of the call,
    // not a derived consequence of it, and a synchronous write is deterministic in tests.
    localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
    this.token.set(accessToken);
  }

  clear(): void {
    localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    this.token.set('');
  }

  /**
   * Ends the session if the token's `exp` has passed. A token whose expiry cannot be read — not a
   * JWT, or one without `exp` — is left alone: that is not proof it is dead, and the API is the one
   * that judges it.
   */
  discardIfExpired(): void {
    const token = this.token();
    if (token !== '' && hasExpired(token)) {
      this.clear();
    }
  }
}

function hasExpired(token: string): boolean {
  try {
    const { exp } = jwtDecode(token);
    return exp !== undefined && exp * 1000 <= Date.now();
  } catch {
    return false;
  }
}
