import { AccessTokenIssuer } from '@identity/domain/service/access-token-issuer';

export class FakeAccessTokenIssuer extends AccessTokenIssuer {
  issue(claims: { sub: string }): string {
    return `token-for:${claims.sub}`;
  }
}
