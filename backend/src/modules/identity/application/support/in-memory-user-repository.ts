import { Identity } from '@framework/domain';
import { UserRepository } from '@identity/domain/service/user.repository';
import { User } from '@identity/domain/user.aggregate';
import { Username } from '@identity/domain/value/username.vo';

// A hand-written fake, not a mock: `UserRepository` is an in-process
// collaborator from a handler's point of view, so tests use a real (if
// simplified) implementation rather than asserting on calls made to it.
export class InMemoryUserRepository extends UserRepository {
  private readonly usersById = new Map<string, User>();

  find(id: Identity): Promise<User | null> {
    return Promise.resolve(this.usersById.get(id.asString()) ?? null);
  }

  async get(id: Identity): Promise<User> {
    const user = await this.find(id);
    if (!user) {
      throw new Error(`No user seeded with id ${id.asString()}`);
    }
    return user;
  }

  save(entity: User): Promise<void> {
    this.usersById.set(entity.id.asString(), entity);
    entity.releaseEvents();
    return Promise.resolve();
  }

  findByUsername(username: Username): Promise<User | null> {
    for (const user of this.usersById.values()) {
      if (user.deleted()) continue;
      if (user.username().equals(username)) return Promise.resolve(user);
    }
    return Promise.resolve(null);
  }

  list(): Promise<User[]> {
    return Promise.resolve(
      [...this.usersById.values()].filter((user) => !user.deleted()),
    );
  }

  seed(user: User): User {
    this.usersById.set(user.id.asString(), user);
    user.releaseEvents();
    return user;
  }
}
