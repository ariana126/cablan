import { UserRepository } from '@identity/domain/service/user.repository';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { ListUsersQuery } from './list-users.query';
import { UserReadModel } from './user.read-model';

@QueryHandler(ListUsersQuery)
export class ListUsersHandler implements IQueryHandler<ListUsersQuery> {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(): Promise<UserReadModel[]> {
    const users = await this.userRepository.list();
    return users.map(
      (user) =>
        new UserReadModel(
          user.id.asString(),
          user.displayName(),
          user.username().asString(),
          user.role(),
        ),
    );
  }
}
