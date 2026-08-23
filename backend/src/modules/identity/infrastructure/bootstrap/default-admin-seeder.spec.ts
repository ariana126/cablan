import { Role } from '@framework/domain';
import { FakePasswordHasher } from '@identity/application/support/fake-password-hasher';
import { InMemoryUserRepository } from '@identity/application/support/in-memory-user-repository';
import { UserRepository } from '@identity/domain/service/user.repository';
import { User } from '@identity/domain/user.aggregate';
import { Username } from '@identity/domain/value/username.vo';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';

import { DefaultAdminSeeder } from './default-admin-seeder';

// A stand-in for `PrismaUserRepository` talking to an unmigrated (or
// unreachable) database — the two cases `seed()` must tolerate rather than
// let crash the process. Every other method is unused by these tests.
class ThrowingUserRepository extends UserRepository {
  constructor(private readonly error: Error) {
    super();
  }

  find(): Promise<User | null> {
    throw new Error('not implemented');
  }

  get(): Promise<User> {
    throw new Error('not implemented');
  }

  save(): Promise<void> {
    throw new Error('not implemented');
  }

  findByUsername(): Promise<User | null> {
    throw this.error;
  }

  list(): Promise<User[]> {
    throw new Error('not implemented');
  }
}

function fakeConfigService(
  values: Record<string, string | undefined>,
): ConfigService {
  return {
    getOrThrow: (key: string) => {
      const value = values[key];
      if (value === undefined) {
        throw new Error(`Missing config key ${key}`);
      }
      return value;
    },
  } as unknown as ConfigService;
}

function makeSut(userRepository: UserRepository) {
  const config = fakeConfigService({
    DEFAULT_ADMIN_USERNAME: 'admin',
    DEFAULT_ADMIN_PASSWORD: 'Adm1nPassw0rd!',
  });
  return new DefaultAdminSeeder(
    userRepository,
    new FakePasswordHasher(),
    config,
  );
}

describe('DefaultAdminSeeder', () => {
  it('seeds a System Admin with a hashed password when none exists', async () => {
    const userRepository = new InMemoryUserRepository();
    const sut = makeSut(userRepository);

    await sut.seed();

    const admin = await userRepository.findByUsername(
      Username.fromString('admin'),
    );
    expect(admin?.role()).toBe(Role.SystemAdmin);
    expect(admin?.passwordHash()).toBe('hashed:Adm1nPassw0rd!');
  });

  it('does nothing when the default admin already exists', async () => {
    const userRepository = new InMemoryUserRepository();
    const sut = makeSut(userRepository);
    await sut.seed();
    const seededUsers = await userRepository.list();
    const [firstSeededId] = seededUsers.map((u) => u.id.asString());

    await sut.seed();

    const admins = await userRepository.list();
    expect(admins).toHaveLength(1);
    expect(admins[0].id.asString()).toBe(firstSeededId);
  });

  it('re-seeds via the PostTruncateHook binding the same way explicit seeding does', async () => {
    const userRepository = new InMemoryUserRepository();
    const sut = makeSut(userRepository);

    await sut.run();

    const admin = await userRepository.findByUsername(
      Username.fromString('admin'),
    );
    expect(admin?.role()).toBe(Role.SystemAdmin);
  });

  it('does not throw when the database has no app_user table yet', async () => {
    const notMigrated = new Prisma.PrismaClientKnownRequestError(
      'The table `public.app_user` does not exist in the current database.',
      { code: 'P2021', clientVersion: '7.9.1' },
    );
    const sut = makeSut(new ThrowingUserRepository(notMigrated));

    await expect(sut.seed()).resolves.toBeUndefined();
  });

  it('does not throw when the database is unreachable', async () => {
    const unreachable = new Prisma.PrismaClientInitializationError(
      "Can't reach database server",
      '7.9.1',
    );
    const sut = makeSut(new ThrowingUserRepository(unreachable));

    await expect(sut.seed()).resolves.toBeUndefined();
  });

  it('still throws for an error unrelated to the database not being ready', async () => {
    const sut = makeSut(
      new ThrowingUserRepository(new Error('something else entirely')),
    );

    await expect(sut.seed()).rejects.toThrow('something else entirely');
  });
});
