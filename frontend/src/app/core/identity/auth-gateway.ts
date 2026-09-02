import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { anonymous } from '../http/auth-context';
import { AuthService } from '../../api/auth/auth.service';
import { CurrentUserStore } from './current-user-store';
import { SessionStore } from './session-store';

/**
 * The one call site that knows `POST /api/auth/login` is anonymous — see `core/http/auth-context.ts`
 * for why that decision belongs here rather than inside the interceptor.
 */
@Injectable({ providedIn: 'root' })
export class AuthGateway {
  private readonly api = inject(AuthService);
  private readonly session = inject(SessionStore);
  private readonly currentUser = inject(CurrentUserStore);

  /**
   * Logs in and stores the returned token in the current session.
   *
   * Username and password are method arguments, not held on this service — a credential is task
   * data for a single call, never state a singleton service should carry.
   */
  login(username: string, password: string): Observable<void> {
    return this.api.authControllerLogin({ username, password }, { context: anonymous() }).pipe(
      map((response) => {
        if (response.accessToken === undefined) {
          throw new Error('Login response carried no access token.');
        }

        this.session.store(response.accessToken);
      }),
    );
  }

  /**
   * Ends the current session. There is no logout endpoint — the token is only ever known to the
   * browser, so nothing on the API needs telling — which makes this a pure client-side action.
   * The caller is responsible for navigating away afterward, same as `login` leaves navigation to
   * its caller.
   */
  logout(): void {
    this.session.clear();
    // The token and the identity it resolved to are one session between them: dropping the token
    // while keeping the resolved user would leave the next person to sign in on this tab looking
    // at the previous one's menu.
    this.currentUser.clear();
  }
}
