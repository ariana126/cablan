import { Role } from '@framework/domain';
import { UsernameAlreadyExists } from '@identity/application/exceptions';
import { FakePasswordHasher } from '@identity/application/support/fake-password-hasher';
import { InMemoryUserRepository } from '@identity/application/support/in-memory-user-repository';
import { User } from '@identity/domain/user.aggregate';
import { Username } from '@identity/domain/value/username.vo';

import { RegisterUserCommand } from './register-user.command';
import { RegisterUserHandler } from './register-user.handler';

function makeSut() {
  const userRepository = new InMemoryUserRepository();
  const passwordHasher = new FakePasswordHasher();
  const sut = new RegisterUserHandler(userRepository, passwordHasher);
  return { sut, userRepository, passwordHasher };
}

describe('RegisterUserHandler', () => {
  it('registers a new user with a hashed password', async () => {
    const { sut, userRepository } = makeSut();

    const result = await sut.execute(
      new RegisterUserCommand(
        'Sina Ghadrdan',
        Username.fromString('sina.q'),
        'Passw0rd!',
        Role.QcInspector,
      ),
    );

    const saved = await userRepository.findByUsername(
      Username.fromString('sina.q'),
    );
    expect(saved?.displayName()).toBe('Sina Ghadrdan');
    expect(saved?.passwordHash()).toBe('hashed:Passw0rd!');
    expect(saved?.role()).toBe(Role.QcInspector);
    expect(result).toEqual({ id: saved?.id.asString() });
  });

  it('rejects registering a username that is already taken', async () => {
    const { sut, userRepository } = makeSut();
    userRepository.seed(
      User.register(
        'Existing User',
        Username.fromString('sina.q'),
        'hashed:whatever',
        Role.Reporter,
      ),
    );

    await expect(
      sut.execute(
        new RegisterUserCommand(
          'Another User',
          Username.fromString('sina.q'),
          'Passw0rd!',
          Role.Management,
        ),
      ),
    ).rejects.toBeInstanceOf(UsernameAlreadyExists);
  });
});
