import { DisplayNameProvider, Identity } from '@framework/domain';
import { UserRepository } from '@identity/domain/service/user.repository';
import { Injectable } from '@nestjs/common';

// The concrete binding a reporting feature (e.g. `boms`' `BomController`)
// resolves through the `DisplayNameProvider` port: backed by the same
// `UserRepository` the rest of this module uses. `userRepository.get()`
// throws `EntityNotFound` for an id that doesn't resolve to a user, which is
// appropriate here — every caller reaches this only after `JwtAuthGuard` (and,
// where present, `RolesGuard`) has already required a valid, currently
// existing user for the very same id.
@Injectable()
export class IdentityDisplayNameProvider extends DisplayNameProvider {
  constructor(private readonly userRepository: UserRepository) {
    super();
  }

  async getName(userId: Identity): Promise<string> {
    const user = await this.userRepository.get(userId);
    return user.displayName();
  }
}
