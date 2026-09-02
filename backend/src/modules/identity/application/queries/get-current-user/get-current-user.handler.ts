import { EntityNotFound } from '@framework/domain';
import { UserRepository } from '@identity/domain/service/user.repository';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { UserReadModel } from '../list-users/user.read-model';
import { GetCurrentUserQuery } from './get-current-user.query';

@QueryHandler(GetCurrentUserQuery)
export class GetCurrentUserHandler implements IQueryHandler<GetCurrentUserQuery> {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(query: GetCurrentUserQuery): Promise<UserReadModel> {
    // `find` plus an explicit `deleted()` check, rather than `get`, for the
    // same reason `IdentityUserRoleProvider` does it: a soft-deleted user's
    // token keeps verifying until it expires, and a deleted account must be
    // indistinguishable from one that never existed.
    const user = await this.userRepository.find(query.userId);
    if (!user || user.deleted()) {
      throw EntityNotFound.withId(query.userId);
    }

    return new UserReadModel(
      user.id.asString(),
      user.displayName(),
      user.username().asString(),
      user.role(),
    );
  }
}
