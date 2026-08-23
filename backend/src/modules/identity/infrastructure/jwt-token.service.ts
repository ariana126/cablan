import { AccessTokenIssuer } from '@identity/domain/service/access-token-issuer';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

// Wraps the one `JwtService` `AuthModule` already configures (secret, 1h
// expiry) — never a second `JwtModule.register(...)`, so token verification
// in `JwtAuthGuard` and issuance here always agree on the same secret.
@Injectable()
export class JwtTokenService extends AccessTokenIssuer {
  constructor(private readonly jwtService: JwtService) {
    super();
  }

  issue(claims: { sub: string }): string {
    return this.jwtService.sign(claims);
  }
}
