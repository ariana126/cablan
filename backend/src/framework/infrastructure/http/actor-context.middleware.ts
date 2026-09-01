import { AsyncLocalStorage } from 'node:async_hooks';

import { ActorContext, Identity } from '@framework/domain';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NextFunction, Request, Response } from 'express';

interface ActorStore {
  readonly userId: string;
}

// Module-scope, not a per-instance field: NestJS does not guarantee that a
// class used both as `MiddlewareConsumer.apply()` middleware and as a
// regular DI-injected provider (here, via `ActorContextModule`'s
// `useExisting: ActorContextMiddleware` binding) resolves to one singleton
// across every module boundary. In practice it doesn't — the middleware
// application path (`AppModule.configure()`) and the application-layer
// injection path (`AuditLogProjector`'s `ActorContext` dependency) end up as
// two separate `ActorContextMiddleware` objects. A per-instance
// `AsyncLocalStorage` field would let `use()` populate one object's store
// while every reader asks a *different* object's empty one — `currentUserId()`
// would report `null` for every request, which is exactly the bug this
// comment now documents. `AsyncLocalStorage` is itself already a
// process-wide primitive; holding exactly one at module scope sidesteps the
// instance-identity question entirely; however many `ActorContextMiddleware`
// objects Nest happens to construct, they all read and write the same store.
const actorStorage = new AsyncLocalStorage<ActorStore>();

// Recovers "who is making this request" from a bearer token, purely from its
// `sub` claim, and makes it available to the rest of the request's call
// stack via `AsyncLocalStorage` — the same mechanism `Clock`'s
// `TunableClock` would use if request-scoped, applied here instead to a
// per-request actor. Registered globally in `AppModule.configure()`, so it
// wraps every request regardless of route.
//
// Deliberately `decode()`, never `verify()`: no signature or expiry check
// happens here — `JwtAuthGuard` remains the actual authorization gate
// downstream, on routes that require one. This middleware runs unconditionally,
// including on public and unauthenticated routes, so it must never reject a
// request itself; it only ever best-effort records an actor id for whichever
// application-layer code reads `ActorContext.currentUserId()` later in the
// same request (e.g. `audit-logging`'s projector). No header, a malformed
// header, or an undecodable token are all treated identically: call `next()`
// with no actor recorded, never throw.
@Injectable()
export class ActorContextMiddleware
  extends ActorContext
  implements NestMiddleware
{
  constructor(private readonly jwtService: JwtService) {
    super();
  }

  use(request: Request, _response: Response, next: NextFunction): void {
    const userId = ActorContextMiddleware.extractUserId(
      request,
      this.jwtService,
    );
    if (userId === null) {
      next();
      return;
    }
    actorStorage.run({ userId }, next);
  }

  currentUserId(): Identity | null {
    const store = actorStorage.getStore();
    return store === undefined ? null : Identity.fromString(store.userId);
  }

  private static extractUserId(
    request: Request,
    jwtService: JwtService,
  ): string | null {
    const header = request.headers['authorization'];
    if (!header?.startsWith('Bearer ')) {
      return null;
    }
    const token = header.slice(7);
    try {
      const payload = jwtService.decode<{ sub?: string }>(token);
      // `payload?.sub ?? null` alone would let an empty-string `sub` through
      // (`??` only guards `null`/`undefined`), and `Identity.fromString`
      // throws on an empty string — this middleware must never throw.
      return typeof payload?.sub === 'string' && payload.sub.trim() !== ''
        ? payload.sub
        : null;
    } catch {
      return null;
    }
  }
}
