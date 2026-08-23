import { Clock } from '@framework/domain';
import { AccessTokenIssuer } from '@identity/domain/service/access-token-issuer';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

// Wraps the one `JwtService` `AuthModule` already configures (secret, 1h
// expiry) — never a second `JwtModule.register(...)`, so token verification
// in `JwtAuthGuard` and issuance here always agree on the same secret.
//
// `iat` is stamped explicitly from the injected `Clock` rather than left to
// `jsonwebtoken`'s own `Date.now()`. `JwtAuthGuard` verifies expiry against
// that same `Clock` port (a `TunableClock` under `NODE_ENV=test`, frozen at
// `DEFAULT_INSTANT` until a test moves it). If issuance stamped `iat` from
// real wall-clock time instead, `exp` (`iat` + 1h) would be computed from
// real time while the guard checks it against test-controlled time — the two
// would never converge, and no amount of advancing the tunable clock could
// make a token expire. Passing `iat` in the payload is enough on its own:
// `jsonwebtoken` uses `payload.iat` as the base for `exp` whenever it is
// already set, only falling back to `Date.now()` when it is absent.
@Injectable()
export class JwtTokenService extends AccessTokenIssuer {
  constructor(
    private readonly jwtService: JwtService,
    private readonly clock: Clock,
  ) {
    super();
  }

  issue(claims: { sub: string }): string {
    return this.jwtService.sign({
      ...claims,
      iat: Math.floor(this.clock.now().getTime() / 1000),
    });
  }
}
