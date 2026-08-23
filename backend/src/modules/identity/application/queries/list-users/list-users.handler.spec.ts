import { Role } from '@framework/domain';
import { InMemoryUserRepository } from '@identity/application/support/in-memory-user-repository';
import { User } from '@identity/domain/user.aggregate';
import { Username } from '@identity/domain/value/username.vo';

import { ListUsersHandler } from './list-users.handler';

describe('ListUsersHandler', () => {
  it('lists every registered user as a read model, without a password hash', async () => {
    const userRepository = new InMemoryUserRepository();
    const sut = new ListUsersHandler(userRepository);
    userRepository.seed(
      User.register(
        'Sina Ghadrdan',
        Username.fromString('sina.q'),
        'hashed:Passw0rd!',
        Role.QcInspector,
      ),
    );

    const result = await sut.execute();

    expect(result).toEqual([
      expect.objectContaining({
        name: 'Sina Ghadrdan',
        username: 'sina.q',
        role: Role.QcInspector,
      }),
    ]);
    expect(result[0]).not.toHaveProperty('passwordHash');
  });

  it('excludes soft-deleted users', async () => {
    const userRepository = new InMemoryUserRepository();
    const sut = new ListUsersHandler(userRepository);
    const deletedUser = User.register(
      'Sina Ghadrdan',
      Username.fromString('sina.q'),
      'hashed:Passw0rd!',
      Role.QcInspector,
    );
    deletedUser.delete();
    userRepository.seed(deletedUser);

    const result = await sut.execute();

    expect(result).toEqual([]);
  });
});
