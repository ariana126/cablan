import { Identity } from '../value/identity.vo';

// The port for "who is making this request right now" — populated per-request
// by `ActorContextMiddleware` (`framework/infrastructure/http/`) from a JWT's
// `sub` claim, decoded (never verified — `JwtAuthGuard` remains the actual
// authorization gate) purely to recover the acting user's id. Modelled after
// `Clock`: an abstract port here, a concrete `AsyncLocalStorage`-backed
// implementation in infrastructure, bound globally by `ActorContextModule` so
// application-layer code (e.g. `audit-logging`'s projector) can depend on the
// port without ever importing `@framework/infrastructure`.
//
// `currentUserId()` returns `null` whenever there is no request in flight, no
// bearer token, or a token that fails to decode — callers must treat that
// defensively rather than assume a value is always present.
//
// The underlying `AsyncLocalStorage` lives at module scope inside
// `ActorContextMiddleware`, not as a field on the class — see that file's own
// comment for why: NestJS does not guarantee that a class used both as
// `MiddlewareConsumer.apply()` middleware and as a regular `useExisting`
// DI-injected provider resolves to a single shared instance, and a
// per-instance store silently broke exactly that way in practice.
export abstract class ActorContext {
  abstract currentUserId(): Identity | null;
}
