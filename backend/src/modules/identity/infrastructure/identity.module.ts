import { PostTruncateHook, UserRoleProvider } from '@framework/domain';
import { CommandHandlers } from '@identity/application/commands';
import { QueryHandlers } from '@identity/application/queries';
import { AccessTokenIssuer } from '@identity/domain/service/access-token-issuer';
import { PasswordHasher } from '@identity/domain/service/password-hasher';
import { UserRepository } from '@identity/domain/service/user.repository';
import { Controllers } from '@identity/infrastructure/http/controllers';
import { Global, Module } from '@nestjs/common';

import { BcryptPasswordHasher } from './bcrypt-password-hasher';
import { DefaultAdminSeeder } from './bootstrap/default-admin-seeder';
import { JwtTokenService } from './jwt-token.service';
import { PrismaUserRepository } from './persistence/user.repository';
import { IdentityUserRoleProvider } from './user-role-provider';

// Global for one reason only: framework's `RolesGuard` (in the always-global
// `AuthModule`) depends on the abstract `UserRoleProvider` port, and only
// this module knows the concrete binding — the same "abstract port lives in
// framework, global module supplies the binding" shape `ClockModule` and
// `EmailModule` already use for `Clock` and `EmailSender`. Every other
// provider here is a normal, module-scoped binding; `@Global()` is not an
// invitation for feature code elsewhere to reach into this module directly —
// cross-module interaction still goes over HTTP, per `modules-isolated`.
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
    DefaultAdminSeeder,
    // `useExisting`, not a second `useClass`, so `TestingService`'s
    // `PostTruncateHook` and this module's own `DefaultAdminSeeder` provider
    // resolve to the exact same singleton — the same trick `ClockModule`/
    // `EmailModule` use for `Clock`/`EmailSender`.
    { provide: PostTruncateHook, useExisting: DefaultAdminSeeder },
  ],
  exports: [UserRoleProvider, PostTruncateHook],
})
export class IdentityModule {}
