import { EntityNotFound, Identity, Role } from '@framework/domain';
import { InMemoryUserRepository } from '@identity/application/support/in-memory-user-repository';
import { User } from '@identity/domain/user.aggregate';
import { Username } from '@identity/domain/value/username.vo';

import { GetCurrentUserHandler } from './get-current-user.handler';
import { GetCurrentUserQuery } from './get-current-user.query';

function aUser(): User {
  return User.register(
    'Sina Ghadrdan',
    Username.fromString('sina.q'),
    'hashed:Passw0rd!',
    Role.QcInspector,
  );
}

describe('GetCurrentUserHandler', () => {
  it('returns the signed-in user as a read model, without a password hash', async () => {
    const userRepository = new InMemoryUserRepository();
    const sut = new GetCurrentUserHandler(userRepository);
    const user = userRepository.seed(aUser());

    const result = await sut.execute(new GetCurrentUserQuery(user.id));

    expect(result).toEqual(
      expect.objectContaining({
        id: user.id.asString(),
        name: 'Sina Ghadrdan',
        username: 'sina.q',
        role: Role.QcInspector,
      }),
    );
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('rejects an id no user was ever registered with', async () => {
    const userRepository = new InMemoryUserRepository();
    const sut = new GetCurrentUserHandler(userRepository);

    await expect(
      sut.execute(new GetCurrentUserQuery(Identity.new())),
    ).rejects.toThrow(EntityNotFound);
  });

  // A soft-deleted user's token still verifies until it expires, so this is
  // reachable in production. Treated as not-found for the same reason
  // `findByUsername` excludes deleted users: a deleted account must be
  // indistinguishable from one that never existed.
  it('rejects a soft-deleted user, whose token still verifies', async () => {
    const userRepository = new InMemoryUserRepository();
    const sut = new GetCurrentUserHandler(userRepository);
    const user = aUser();
    user.delete();
    userRepository.seed(user);

    await expect(sut.execute(new GetCurrentUserQuery(user.id))).rejects.toThrow(
      EntityNotFound,
    );
  });
});
