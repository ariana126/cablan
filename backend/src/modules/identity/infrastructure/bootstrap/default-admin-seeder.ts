import { PostTruncateHook, Role } from '@framework/domain';
import { PasswordHasher } from '@identity/domain/service/password-hasher';
import { UserRepository } from '@identity/domain/service/user.repository';
import { User } from '@identity/domain/user.aggregate';
import { Username } from '@identity/domain/value/username.vo';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';

const DEFAULT_ADMIN_NAME = 'System Admin';

/**
 * Seeds one System Admin so the very first login has an account to use — no
 * test-only bypass endpoint, QA logs in as this account through the real
 * `POST /api/auth/login` and registers everyone else through the real
 * register endpoint.
 *
 * Runs on two triggers that share one method: `main.ts` calls `seed()`
 * explicitly after `app.listen()`, and `run()` (the `PostTruncateHook`
 * binding) covers the test stack's `POST /testing/truncate`, which runs
 * inside an already-started process and would otherwise leave it without its
 * seeded admin for the rest of the run. `run()` is awaited by
 * `TestingService.truncateAll()` itself, not dispatched through `EventBus` —
 * see `PostTruncateHook`'s own comment for why that distinction is load-bearing
 * here (a fire-and-forget event let the very next request race an
 * unfinished re-seed).
 *
 * Deliberately **not** an `OnApplicationBootstrap` hook: that fires on
 * `app.init()` as much as on `app.listen()`, and `generate-swagger.ts` calls
 * `app.init()` to build the DI graph without a database behind it — a
 * lifecycle hook here would make swagger generation query the database,
 * breaking the "these checks need nothing running" invariant every other
 * quality check relies on (see `backend/CLAUDE.md`'s Commands section).
 * Explicit, `main.ts`-only invocation is what keeps `app.init()` side-effect
 * free.
 *
 * `seed()` must never let the database simply *not being ready yet* crash
 * the process. Both stacks can boot before their schema exists: the dev
 * stack migrates only via the manual `make migrate`, and the test stack
 * only via the acceptance suite's `BeforeAll` calling
 * `POST /testing/migrations` — `main.ts`'s call always runs before either of
 * those on a fresh volume. Failing here is recoverable, not a programming
 * error: once migrations do run, the test stack's first `POST
 * /testing/truncate` retries this same seed via `run()` — so a boot-time
 * failure just means "seeded a little later" rather than "never seeded".
 */
@Injectable()
export class DefaultAdminSeeder implements PostTruncateHook {
  private readonly logger = new Logger(DefaultAdminSeeder.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly config: ConfigService,
  ) {}

  async run(): Promise<void> {
    await this.seed();
  }

  async seed(): Promise<void> {
    try {
      await this.ensureDefaultAdminExists();
    } catch (error) {
      if (!this.isDatabaseNotReadyError(error)) {
        throw error;
      }
      this.logger.warn(
        'Skipping default admin seed: the database is not migrated or ' +
          'reachable yet. It will be retried on the next truncate (or the ' +
          'next process start).',
      );
    }
  }

  /**
   * `P2021` ("table does not exist") is the case this actually guards — an
   * unmigrated database. `PrismaClientInitializationError` (the database
   * itself unreachable) is tolerated for the identical reason, even though
   * `db`'s own healthcheck makes it unlikely in practice: either way, "the
   * database isn't ready" is not a programming error worth crashing boot
   * over, and any other error (e.g. a missing `DEFAULT_ADMIN_USERNAME`/
   * `DEFAULT_ADMIN_PASSWORD` env var from `ConfigService.getOrThrow`) still
   * propagates, since that *is* a misconfiguration worth failing loudly on.
   */
  private isDatabaseNotReadyError(error: unknown): boolean {
    return (
      (error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2021') ||
      error instanceof Prisma.PrismaClientInitializationError
    );
  }

  private async ensureDefaultAdminExists(): Promise<void> {
    const username = Username.fromString(
      this.config.getOrThrow<string>('DEFAULT_ADMIN_USERNAME'),
    );

    const existingAdmin = await this.userRepository.findByUsername(username);
    if (existingAdmin) {
      return;
    }

    const hashedPassword = await this.passwordHasher.hash(
      this.config.getOrThrow<string>('DEFAULT_ADMIN_PASSWORD'),
    );

    const admin = User.register(
      DEFAULT_ADMIN_NAME,
      username,
      hashedPassword,
      Role.SystemAdmin,
    );
    await this.userRepository.save(admin);
  }
}
