import { computed, inject, Injectable, Signal, signal } from '@angular/core';
import { catchError, firstValueFrom, of } from 'rxjs';

import { Role } from '../../api/model';
import { AppUser, UsersGateway } from '../users/users-gateway';
import { SessionStore } from './session-store';

/**
 * Who is signed in, fetched once per session and remembered.
 *
 * The app needs the caller's role to decide what to show, and the bearer token does not carry one —
 * the API issues a token with `sub` alone, on purpose, so that a demotion takes effect immediately
 * instead of waiting out the token's hour. `GET /api/users/me` is the only way to ask, and asking
 * once per page load is the cost of that decision.
 *
 * `load()` is a promise rather than a signal because the route table has to *await* it: a route
 * cannot decide which component to render until the role is known. `user()` and `role()` are
 * signals because the drawer and the home page only read whatever is known by now.
 */
@Injectable({ providedIn: 'root' })
export class CurrentUserStore {
  private readonly gateway = inject(UsersGateway);
  private readonly session = inject(SessionStore);

  private readonly currentUser = signal<AppUser | null>(null);

  /** The in-flight or settled fetch, so concurrent callers share one request rather than racing. */
  private pending: Promise<AppUser | null> | null = null;

  /**
   * The token `pending` was fetched with. The session can end or change hands without anyone
   * calling `clear()` here — a token that expired, or one the API rejected — so the cache is tied to
   * the token rather than trusted until told otherwise.
   */
  private pendingFor = '';

  readonly user: Signal<AppUser | null> = this.currentUser.asReadonly();

  /** `null` means "no role known" — anonymous, or a lookup that failed. Never a guessed default. */
  readonly role = computed<Role | null>(() => this.currentUser()?.role ?? null);

  /**
   * Resolves the signed-in user, fetching on the first call for a given token and reusing the answer
   * afterwards.
   *
   * Never rejects. A failed lookup resolves to `null`, which every caller already handles as "no
   * role": the drawer offers nothing but home, and a guarded route renders its 404. Rejecting
   * instead would surface as an unhandled navigation error, which is a worse answer to a network
   * blip than a temporarily empty menu. (A 401 is the exception in effect, not in shape: it still
   * resolves `null`, but the interceptor has ended the session by then, and the guard reads that.)
   */
  load(): Promise<AppUser | null> {
    const token = this.session.accessToken();

    if (token !== this.pendingFor) {
      this.clear();
    }

    if (token === '') {
      return Promise.resolve(null);
    }

    const pending =
      this.pending ??
      firstValueFrom(this.gateway.me().pipe(catchError(() => of(null)))).then((user) => {
        // A fetch that outlived its token (the session ended or changed while it was in flight)
        // must not publish its answer as the current user's.
        if (this.pending === pending) {
          this.currentUser.set(user);
        }
        return user;
      });
    this.pending = pending;
    this.pendingFor = token;

    return pending;
  }

  /**
   * Forgets the current user. Called from `AuthGateway.logout()` alongside `SessionStore.clear()` —
   * without it, the next person to sign in on this tab would inherit the previous one's menu until
   * something happened to refetch.
   */
  clear(): void {
    this.currentUser.set(null);
    this.pending = null;
    this.pendingFor = '';
  }
}
