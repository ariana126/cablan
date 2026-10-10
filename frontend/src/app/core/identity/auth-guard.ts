import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { CurrentUserStore } from './current-user-store';
import { SessionStore } from './session-store';

/**
 * Sends anyone without a live session to log in, remembering where they were headed — whatever the
 * URL, so an outsider cannot tell a real page from a missing one by what it renders. Every route but
 * `/login` carries it, the catch-all not-found route included.
 *
 * "Live" is decided in two steps. An absent or expired token (`SessionStore.discardIfExpired()`)
 * redirects at once, without a request. Any other token is put to the API through
 * `CurrentUserStore.load()` — the same `GET /api/users/me` the route table needs for the role
 * anyway, so this costs nothing extra — and a 401 there ends the session in the interceptor, which
 * this guard reads afterwards. A forged or revoked token therefore never gets as far as a 404 either.
 *
 * **This is not security.** It is a redirect that saves the user from a page that would only fail;
 * anyone can edit the bundle. The API is what actually enforces authentication, and it would 401
 * regardless of what this returns.
 *
 * Returning a `UrlTree` rather than calling `router.navigate()` and returning `false` matters: the
 * router treats the tree as a redirect within the same navigation, so there is no flash of a
 * cancelled route on the way through.
 */
export const authGuard: CanActivateFn = async (_route, state) => {
  const session = inject(SessionStore);
  const currentUser = inject(CurrentUserStore);
  const router = inject(Router);

  const toLogin = () => router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });

  session.discardIfExpired();
  if (!session.isAuthenticated()) {
    return toLogin();
  }

  await currentUser.load();

  return session.isAuthenticated() || toLogin();
};
