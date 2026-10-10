import { inject, Type } from '@angular/core';
import { Route } from '@angular/router';

import { authGuard } from './auth-guard';
import { CurrentUserStore } from './current-user-store';
import { canReach } from './navigation';

/** The title a withheld page wears, identical to the one a genuinely missing page wears. */
export const NOT_FOUND_TITLE = 'صفحه پیدا نشد · کابلان';

const notFoundPage = (): Promise<Type<unknown>> =>
  import('../../features/not-found/not-found-page').then((m) => m.NotFoundPage);

interface GuardedRouteConfig {
  /** The route path, which must match a page in `navigation.ts`. */
  readonly path: string;
  readonly title: string;
  readonly load: () => Promise<Type<unknown>>;
}

/**
 * A route only the roles in `navigation.ts` may see — rendering the not-found page, in place, to
 * everyone else.
 *
 * **Why this is not a `canActivate` guard.** A guard can only allow, block or redirect. Redirecting
 * a withheld page to `/not-found` would itself be the tell: `/users` bouncing while `/no-such-page`
 * renders where it stands proves `/users` is a real route, which is exactly what a user without
 * access must not be able to learn. Deciding inside `loadComponent` instead leaves the URL, the
 * document title and the rendered page identical to a genuine 404 — Angular runs both `loadComponent`
 * and a `ResolveFn` title inside the route's injection context, which is what makes this possible.
 *
 * Both callbacks await the same `CurrentUserStore.load()`, which fetches once and caches, so a
 * navigation costs one request rather than two.
 *
 * All of that is for a visitor with a live session. `authGuard` runs first, and sends anyone without
 * one — no token, an expired one, or one the API rejects — to log in before any of this is decided,
 * on this route and on `notFoundRoute()` alike. That is what keeps an outsider from probing the
 * route table: every URL, real, withheld or missing, answers them with the same redirect.
 *
 * **None of this is a security boundary**, for the same reason `auth-guard.ts` says it is not: the
 * table ships in the bundle. The API refuses the data; this only refuses the page.
 */
export function guardedRoute({ path, title, load }: GuardedRouteConfig): Route {
  const allowed = async (): Promise<boolean> => {
    const user = await inject(CurrentUserStore).load();
    return canReach(path, user?.role ?? null);
  };

  return {
    path,
    canActivate: [authGuard],
    title: async () => ((await allowed()) ? title : NOT_FOUND_TITLE),
    // `notFoundPage()` is an `import()` like every other page loader, so a withheld route pulls
    // down the same chunk a nonexistent one would.
    loadComponent: async () => ((await allowed()) ? load() : notFoundPage()),
  };
}

/**
 * The catch-all: the not-found page for a path no route matches — but only for a visitor with a
 * live session. It carries `authGuard` like every `guardedRoute`, so an anonymous visitor is sent
 * to log in from `/no-such-page` exactly as from `/users`, and cannot tell the two apart.
 */
export function notFoundRoute(): Route {
  return {
    path: '**',
    canActivate: [authGuard],
    title: NOT_FOUND_TITLE,
    loadComponent: notFoundPage,
  };
}
