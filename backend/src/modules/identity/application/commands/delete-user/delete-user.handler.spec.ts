import { Role } from '@framework/domain';
import { InMemoryUserRepository } from '@identity/application/support/in-memory-user-repository';
import { User } from '@identity/domain/user.aggregate';
import { Username } from '@identity/domain/value/username.vo';

import { DeleteUserCommand } from './delete-user.command';
import { DeleteUserHandler } from './delete-user.handler';

describe('DeleteUserHandler', () => {
  it('soft-deletes a user, and its username becomes free again', async () => {
    const userRepository = new InMemoryUserRepository();
    const sut = new DeleteUserHandler(userRepository);
    const user = userRepository.seed(
      User.register(
        'Sina Ghadrdan',
        Username.fromString('sina.q'),
        'hashed:Passw0rd!',
        Role.QcInspector,
      ),
    );

    await sut.execute(new DeleteUserCommand(user.id));

    const stillThere = await userRepository.get(user.id);
    expect(stillThere.deleted()).toBe(true);
    expect(
      await userRepository.findByUsername(Username.fromString('sina.q')),
    ).toBeNull();
  });
});
