import { Identity, Role, UserRoleProvider } from '@framework/domain';
import { UserRepository } from '@identity/domain/service/user.repository';
import { Injectable } from '@nestjs/common';

// The concrete binding `RolesGuard` (in framework) resolves through the
// `UserRoleProvider` port: looked up fresh on every request, backed by the
// same `UserRepository` the rest of this module uses, so a role change or a
// soft delete is visible to `RolesGuard` immediately — no waiting on the JWT
// to expire.
@Injectable()
export class IdentityUserRoleProvider extends UserRoleProvider {
  constructor(private readonly userRepository: UserRepository) {
    super();
  }

  async getRole(userId: Identity): Promise<Role | null> {
    const user = await this.userRepository.find(userId);
    if (!user || user.deleted()) {
      return null;
    }
    return user.role();
  }
}
