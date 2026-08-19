import { HttpContext, HttpContextToken } from '@angular/common/http';

/**
 * Marks a request that must go out without the bearer token.
 *
 * **Why a context token rather than a URL list inside the interceptor.** An anonymous endpoint (a
 * login call, a registration call) is distinguished from an authenticated one by more than its path
 * prefix. An interceptor deciding this would have to re-encode route-and-method knowledge the
 * generated client already owns, in a place no gate keeps in step with the contract. The call site
 * is the only code that knows whether it is calling an anonymous endpoint, so the decision belongs
 * there — in whatever gateway service owns that call.
 */
export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);

/** Use as `{ context: anonymous() }` on a generated client call that must carry no token. */
export function anonymous(): HttpContext {
  return new HttpContext().set(SKIP_AUTH, true);
}
