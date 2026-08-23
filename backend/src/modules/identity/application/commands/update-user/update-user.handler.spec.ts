import { Role } from '@framework/domain';
import {
  CannotChangeOwnRole,
  UsernameAlreadyExists,
} from '@identity/application/exceptions';
import { FakePasswordHasher } from '@identity/application/support/fake-password-hasher';
import { InMemoryUserRepository } from '@identity/application/support/in-memory-user-repository';
import { User } from '@identity/domain/user.aggregate';
import { Username } from '@identity/domain/value/username.vo';

import { UpdateUserCommand } from './update-user.command';
import { UpdateUserHandler } from './update-user.handler';

function makeSut() {
  const userRepository = new InMemoryUserRepository();
  const passwordHasher = new FakePasswordHasher();
  const sut = new UpdateUserHandler(userRepository, passwordHasher);
  return { sut, userRepository, passwordHasher };
}

function seedUser(
  userRepository: InMemoryUserRepository,
  username: string,
  role: Role = Role.QcInspector,
): User {
  return userRepository.seed(
    User.register(
      'Sina Ghadrdan',
      Username.fromString(username),
      'hashed:Passw0rd!',
      role,
    ),
  );
}

describe('UpdateUserHandler', () => {
  it('renames a user', async () => {
    const { sut, userRepository } = makeSut();
    const user = seedUser(userRepository, 'sina.q');

    await sut.execute(
      new UpdateUserCommand(user.id, user.id, 'Sina Q.', undefined),
    );

    const saved = await userRepository.get(user.id);
    expect(saved.displayName()).toBe('Sina Q.');
  });

  it('changes a username', async () => {
    const { sut, userRepository } = makeSut();
    const user = seedUser(userRepository, 'sina.q');

    await sut.execute(
      new UpdateUserCommand(
        user.id,
        user.id,
        undefined,
        Username.fromString('sina.ghadrdan'),
      ),
    );

    const saved = await userRepository.get(user.id);
    expect(saved.username().asString()).toBe('sina.ghadrdan');
  });

  it('rejects changing a username to one already taken by another user', async () => {
    const { sut, userRepository } = makeSut();
    seedUser(userRepository, 'sina.q');
    const other = seedUser(userRepository, 'ariana.m');

    await expect(
      sut.execute(
        new UpdateUserCommand(
          other.id,
          other.id,
          undefined,
          Username.fromString('sina.q'),
        ),
      ),
    ).rejects.toBeInstanceOf(UsernameAlreadyExists);
  });

  it('changes a password through the password hasher', async () => {
    const { sut, userRepository } = makeSut();
    const user = seedUser(userRepository, 'sina.q');

    await sut.execute(
      new UpdateUserCommand(
        user.id,
        user.id,
        undefined,
        undefined,
        'NewPassw0rd!',
      ),
    );

    const saved = await userRepository.get(user.id);
    expect(saved.passwordHash()).toBe('hashed:NewPassw0rd!');
  });

  it("changes another user's role", async () => {
    const { sut, userRepository } = makeSut();
    const actingAdmin = seedUser(userRepository, 'admin', Role.SystemAdmin);
    const target = seedUser(userRepository, 'sina.q', Role.QcInspector);

    await sut.execute(
      new UpdateUserCommand(
        target.id,
        actingAdmin.id,
        undefined,
        undefined,
        undefined,
        Role.Management,
      ),
    );

    const saved = await userRepository.get(target.id);
    expect(saved.role()).toBe(Role.Management);
  });

  it('rejects a system admin changing their own role, leaving the user untouched', async () => {
    const { sut, userRepository } = makeSut();
    const actingAdmin = seedUser(userRepository, 'admin', Role.SystemAdmin);

    await expect(
      sut.execute(
        new UpdateUserCommand(
          actingAdmin.id,
          actingAdmin.id,
          undefined,
          undefined,
          undefined,
          Role.Reporter,
        ),
      ),
    ).rejects.toBeInstanceOf(CannotChangeOwnRole);

    const saved = await userRepository.get(actingAdmin.id);
    expect(saved.role()).toBe(Role.SystemAdmin);
  });

  it('allows a system admin to change their own name, username and password', async () => {
    const { sut, userRepository } = makeSut();
    const actingAdmin = seedUser(userRepository, 'admin', Role.SystemAdmin);

    await sut.execute(
      new UpdateUserCommand(
        actingAdmin.id,
        actingAdmin.id,
        'New Name',
        Username.fromString('new.admin'),
        'NewPassw0rd!',
      ),
    );

    const saved = await userRepository.get(actingAdmin.id);
    expect(saved.displayName()).toBe('New Name');
    expect(saved.username().asString()).toBe('new.admin');
    expect(saved.passwordHash()).toBe('hashed:NewPassw0rd!');
  });
});
