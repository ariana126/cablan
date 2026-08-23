import { Role } from '../role';
import { Identity } from '../value/identity.vo';

// A JWT only ever carries `sub` (see JwtAuthGuard) — never a role, since a
// role can change (or the account can be deleted) after a token is issued
// but before it expires. RolesGuard resolves the current role through this
// port on every request instead, so a demotion or deletion takes effect
// immediately rather than waiting out the token's lifetime. The `identity`
// module provides the concrete binding; `null` means "no current role"
// (unknown or deleted user), which RolesGuard treats as forbidden.
export abstract class UserRoleProvider {
  abstract getRole(userId: Identity): Promise<Role | null>;
}
