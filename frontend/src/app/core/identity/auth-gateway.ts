import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { anonymous } from '../http/auth-context';
import { AuthService } from '../../api/auth/auth.service';
import { SessionStore } from './session-store';

/**
 * The one call site that knows `POST /api/auth/login` is anonymous — see `core/http/auth-context.ts`
 * for why that decision belongs here rather than inside the interceptor.
 */
@Injectable({ providedIn: 'root' })
export class AuthGateway {
  private readonly api = inject(AuthService);
  private readonly session = inject(SessionStore);

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
}
