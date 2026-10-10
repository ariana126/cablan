import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { SessionStore } from '../identity/session-store';
import { SKIP_AUTH } from './auth-context';

/**
 * Attaches the bearer token to API requests, and reacts when the API rejects it.
 *
 * This is where authentication lives, rather than threaded through the generated client — the
 * contract's `bearer` scheme is a transport concern and orval does not generate it.
 */
export const accessTokenInterceptor: HttpInterceptorFn = (request, next) => {
  // Never let the token leave this origin. The generated client only ever emits relative `/api`
  // routes, so this is defensive — but it costs one comparison and the failure it prevents (a bearer
  // token in someone else's access log) cannot be undone.
  if (!request.url.startsWith('/api/') || request.context.get(SKIP_AUTH)) {
    return next(request);
  }

  const session = inject(SessionStore);
  const router = inject(Router);
  const dialog = inject(MatDialog);

  // A token past its `exp` is dropped here rather than sent: it would only earn a 401, and dropping
  // it first means the session ends on this call even if the API is slow to say so.
  session.discardIfExpired();
  const token = session.accessToken();
  const authorized =
    token === '' ? request : request.clone({ setHeaders: { Authorization: `Bearer ${token}` } });

  return next(authorized).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        endSession(token, session, dialog, router);
      }

      // Always rethrow. The interceptor handles the session; what the *user* sees is the caller's
      // decision, and a swallowed error would leave a form waiting forever.
      return throwError(() => error);
    }),
  );
};

/**
 * Any 401 on an authenticated request means there is no live session, so the visitor goes to log
 * in. Requests marked `SKIP_AUTH` never get here at all, which is what stops a failed login (a 401
 * meaning "wrong password") from being mistaken for an expired session.
 */
function endSession(sent: string, session: SessionStore, dialog: MatDialog, router: Router): void {
  // Only the token that was rejected is dropped. One that arrived while this request was in flight
  // — a login completing in the meantime — has not been judged, and must survive.
  if (session.accessToken() === sent) {
    session.clear();
  }
  if (session.isAuthenticated()) {
    return;
  }

  // The router swaps the routed page, but a dialog's overlay lives outside the router outlet
  // (appended straight to <body>), so a route change alone leaves it stuck on top of whatever
  // renders next — closing it explicitly is what a navigation can't do here.
  dialog.closeAll();

  // Mid-navigation, the redirect belongs to `authGuard`, which reads the session this just cleared
  // and knows where the visitor was *headed*; `router.url` would still name where they came from.
  // From `/login` there is nowhere to send them, and a redirect would nest `returnUrl` into itself.
  if (router.currentNavigation() === null && !router.url.startsWith('/login')) {
    void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
  }
}
