import { Identity } from '../value/identity.vo';

// A JWT only ever carries `sub` (see JwtAuthGuard) — never a display name.
// Features that clone "who did this" onto their own aggregates at the moment
// of action (e.g. a daily BOM's `registeredBy`) resolve the acting user's
// current name through this port instead of duplicating `identity`'s own
// `User` aggregate or importing its domain layer directly — the same
// "abstract port lives in framework, feature module supplies the binding"
// shape `UserRoleProvider` already uses. The `identity` module provides the
// concrete binding.
export abstract class DisplayNameProvider {
  abstract getName(userId: Identity): Promise<string>;
}
