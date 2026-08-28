import {
  DisplayNameProvider,
  PostTruncateHook,
  UserRoleProvider,
} from '@framework/domain';
import { CommandHandlers } from '@identity/application/commands';
import { QueryHandlers } from '@identity/application/queries';
import { AccessTokenIssuer } from '@identity/domain/service/access-token-issuer';
import { PasswordHasher } from '@identity/domain/service/password-hasher';
import { UserRepository } from '@identity/domain/service/user.repository';
import { Controllers } from '@identity/infrastructure/http/controllers';
import { Global, Module } from '@nestjs/common';

import { BcryptPasswordHasher } from './bcrypt-password-hasher';
import { DefaultAdminSeeder } from './bootstrap/default-admin-seeder';
import { IdentityDisplayNameProvider } from './display-name-provider';
import { JwtTokenService } from './jwt-token.service';
import { PrismaUserRepository } from './persistence/user.repository';
import { IdentityUserRoleProvider } from './user-role-provider';

// Global for one reason only: framework's `RolesGuard` (in the always-global
// `AuthModule`) depends on the abstract `UserRoleProvider` port, and only
// this module knows the concrete binding — the same "abstract port lives in
// framework, global module supplies the binding" shape `ClockModule` and
// `EmailModule` already use for `Clock` and `EmailSender`. `DisplayNameProvider`
// is exported for the same reason, one level removed: it has no built-in
// consumer of its own the way `RolesGuard` consumes `UserRoleProvider`, but a
// reporting feature module (`boms`) needs to resolve a display name from an
// id without importing this module's domain layer directly, and exporting it
// from this already-global module is the cheapest way to make that
// resolvable everywhere. Every other provider here is a normal,
// module-scoped binding; `@Global()` is not an invitation for feature code
// elsewhere to reach into this module directly — cross-module interaction
// still goes over HTTP, per `modules-isolated`.
@Global()
@Module({
  controllers: [...Controllers],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    { provide: UserRepository, useClass: PrismaUserRepository },
    { provide: PasswordHasher, useClass: BcryptPasswordHasher },
    { provide: AccessTokenIssuer, useClass: JwtTokenService },
    { provide: UserRoleProvider, useClass: IdentityUserRoleProvider },
    { provide: DisplayNameProvider, useClass: IdentityDisplayNameProvider },
    DefaultAdminSeeder,
    // `useExisting`, not a second `useClass`, so `TestingService`'s
    // `PostTruncateHook` and this module's own `DefaultAdminSeeder` provider
    // resolve to the exact same singleton — the same trick `ClockModule`/
    // `EmailModule` use for `Clock`/`EmailSender`.
    { provide: PostTruncateHook, useExisting: DefaultAdminSeeder },
  ],
  exports: [UserRoleProvider, DisplayNameProvider, PostTruncateHook],
})
export class IdentityModule {}
