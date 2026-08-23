// Deliberately narrow: the token carries only `sub`, matching what
// `JwtAuthGuard` verifies and nothing more. Role is never a claim — a role
// (or a deletion) can change after the token is issued but before its 1h
// expiry, so `RolesGuard` looks the current role up live through
// `UserRoleProvider` instead of trusting anything encoded here. See that
// port's comment in `@framework/domain` for the full reasoning.
export abstract class AccessTokenIssuer {
  abstract issue(claims: { sub: string }): string;
}
