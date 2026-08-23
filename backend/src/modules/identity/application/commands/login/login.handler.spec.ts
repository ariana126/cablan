import { Role } from '@framework/domain';
import { InvalidCredentials } from '@identity/application/exceptions';
import { FakeAccessTokenIssuer } from '@identity/application/support/fake-access-token-issuer';
import { FakePasswordHasher } from '@identity/application/support/fake-password-hasher';
import { InMemoryUserRepository } from '@identity/application/support/in-memory-user-repository';
import { User } from '@identity/domain/user.aggregate';
import { Username } from '@identity/domain/value/username.vo';

import { LoginCommand } from './login.command';
import { LoginHandler } from './login.handler';

function makeSut() {
  const userRepository = new InMemoryUserRepository();
  const passwordHasher = new FakePasswordHasher();
  const accessTokenIssuer = new FakeAccessTokenIssuer();
  const sut = new LoginHandler(
    userRepository,
    passwordHasher,
    accessTokenIssuer,
  );
  return { sut, userRepository };
}

describe('LoginHandler', () => {
  it('issues an access token for correct credentials', async () => {
    const { sut, userRepository } = makeSut();
    const user = userRepository.seed(
      User.register(
        'Sina Ghadrdan',
        Username.fromString('sina.q'),
        'hashed:Passw0rd!',
        Role.QcInspector,
      ),
    );

    const result = await sut.execute(
      new LoginCommand(Username.fromString('sina.q'), 'Passw0rd!'),
    );

    expect(result.accessToken).toBe(`token-for:${user.id.asString()}`);
  });

  it('rejects a wrong password', async () => {
    const { sut, userRepository } = makeSut();
    userRepository.seed(
      User.register(
        'Sina Ghadrdan',
        Username.fromString('sina.q'),
        'hashed:Passw0rd!',
        Role.QcInspector,
      ),
    );

    await expect(
      sut.execute(
        new LoginCommand(Username.fromString('sina.q'), 'wrong-pass'),
      ),
    ).rejects.toBeInstanceOf(InvalidCredentials);
  });

  it('rejects an unknown username', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(
        new LoginCommand(Username.fromString('unknown.user'), 'Passw0rd!'),
      ),
    ).rejects.toBeInstanceOf(InvalidCredentials);
  });

  it('is case-sensitive about the username', async () => {
    const { sut, userRepository } = makeSut();
    userRepository.seed(
      User.register(
        'Sina Ghadrdan',
        Username.fromString('sina.q'),
        'hashed:Passw0rd!',
        Role.QcInspector,
      ),
    );

    await expect(
      sut.execute(new LoginCommand(Username.fromString('SINA.Q'), 'Passw0rd!')),
    ).rejects.toBeInstanceOf(InvalidCredentials);
  });

  it('rejects credentials for a deleted user, same as an unknown one', async () => {
    const { sut, userRepository } = makeSut();
    const user = userRepository.seed(
      User.register(
        'Sina Ghadrdan',
        Username.fromString('sina.q'),
        'hashed:Passw0rd!',
        Role.QcInspector,
      ),
    );
    user.delete();
    await userRepository.save(user);

    await expect(
      sut.execute(new LoginCommand(Username.fromString('sina.q'), 'Passw0rd!')),
    ).rejects.toBeInstanceOf(InvalidCredentials);
  });
});
