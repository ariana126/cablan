import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import { accessTokenInterceptor } from './core/http/access-token-interceptor';
import { provideJalaliDateAdapter } from './core/material/jalali-date-adapter';
import { PersianPaginatorIntl } from './core/material/persian-paginator-intl';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // `withComponentInputBinding` binds route and query params straight to `input()` signals, so a
    // page reads `returnUrl` as an input rather than reaching into `ActivatedRoute.snapshot`.
    provideRouter(routes, withComponentInputBinding()),
    // The contract's `bearer` scheme is not generated, so it lives in this interceptor rather than
    // being threaded through every generated call. A request that must go out unauthenticated opts
    // out at the call site with `{ context: anonymous() }` — see core/http/auth-context.ts.
    provideHttpClient(withInterceptors([accessTokenInterceptor])),
    // Registered once, root-wide, so every `mat-paginator` this app ever adds reads Persian labels
    // with no per-page wiring — see core/material/persian-paginator-intl.ts.
    { provide: MatPaginatorIntl, useClass: PersianPaginatorIntl },
    // What makes every `mat-datepicker` and `mat-timepicker` in the app a Jalali calendar and a
    // 24-hour Persian clock — see core/material/jalali-date-adapter.ts, and
    // core/date/jalali-datetime.ts for why the app carries no calendar arithmetic of its own.
    provideJalaliDateAdapter(),
  ],
};
