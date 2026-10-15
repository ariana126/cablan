# Write audit entries in the same transaction as the change: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task by task. Steps use
> checkbox (`- [ ]`) syntax for tracking. In this repo, Tasks 1–5 are carried out by the
> `backend-engineer` sub-agent, which reads `backend/CLAUDE.md` before starting. Tasks 6–7 touch
> only root files and are run by the orchestrator itself.

**Goal:** Every committed change to an aggregate has its audit entry, and every audit entry belongs
to a committed change. Both are written in one Postgres transaction, so a failure in either rolls
back both.

**Architecture:** `nestjs-cls` with the `@nestjs-cls/transactional` plugin and its Prisma adapter
gives every provider a `TransactionHost` whose `tx` is the ambient transaction client.
`PrismaEntityRepository.save()`/`delete()` run the aggregate write and an awaited, sequential,
in-process domain-event dispatch inside one `txHost.withTransaction()`. The dispatcher lives in
`framework/` (`DomainEventDispatcher` port, `@DomainEventHandler` decorator, a
`DiscoveryService`-backed implementation) and replaces `@nestjs/cqrs`' `EventBus` for domain events.
The audit projector stops swallowing errors, so a failed projection fails the command. A new
backend integration suite, run against the test stack's Postgres, proves the atomicity and becomes
the tenth CI gate.

**Tech Stack:** NestJS 11 (`@nestjs/core` 11.1, `DiscoveryService`, `Reflector`), `@nestjs/cqrs`
11.0.3 (kept for `CommandBus`/`QueryBus`), Prisma 7.8 (`prisma-client-js`, `@prisma/adapter-pg`),
`nestjs-cls` 7.0.1, `@nestjs-cls/transactional` 4.0.1,
`@nestjs-cls/transactional-adapter-prisma` 2.0.1, Jest 30 + ts-jest, Docker Compose. All commands
run in containers through `make` or `docker compose -f backend/...`.

**Spec:** `docs/superpowers/specs/2026-10-15-transactional-audit-trail-design.md`, implementing
`docs/adrs/0007-transactional-audit-trail.md`. Read both before starting. Where this plan and the
spec disagree, the spec wins, **except** for the deliberate resolutions listed at the end of Global
Constraints.

## Global Constraints

- **Precondition:** both earlier refactorings have landed on this branch:
  - `standard-boms` → `manufacturing-instructions` (backend only). Classes `ManufacturingInstruction*`,
    Prisma models `ManufacturingInstruction`/`ManufacturingInstructionComponent`/
    `ManufacturingInstructionMaterial` (tables unchanged), accessor `prisma.manufacturingInstruction`,
    hand-written delegate `ManufacturingInstructionDelegate`.
  - `materials` + `components` merged into `products` (flat). Paths such as
    `products/domain/material.aggregate.ts`,
    `products/infrastructure/persistence/material.repository.ts`, audit handlers under
    `audit-logging/application/event-handlers/products/`. No `@materials/*` or `@components/*` alias;
    one `ProductsModule`.

  Every path and name below assumes that state. Task 1 Step 1 checks it.
- Packages, exactly: `nestjs-cls@^7.0.1`, `@nestjs-cls/transactional@^4.0.1`,
  `@nestjs-cls/transactional-adapter-prisma@^2.0.1` (peer `prisma`/`@prisma/client` `> 4 < 9`).
  Install them with npm **inside the backend container**, so `backend/package-lock.json` stays
  authoritative. Never edit `package-lock.json` by hand (a hook blocks it anyway).
- Only these may change: files under `backend/`, the root `Makefile`, `.github/workflows/ci.yml`,
  the root `CLAUDE.md`, and `docs/adrs/`. Nothing under `frontend/` or `acceptance-tests/`.
- No routes, DTOs or OpenAPI change: `make generate-swagger` must leave `backend/docs/openapi.*`
  byte-identical.
- No migration: nothing new under `backend/prisma/migrations/`, and no `.prisma` file changes.
- Domain events, their payloads, audit `recordType` values and change keys are unchanged.
- `@nestjs/cqrs` stays for `CommandBus` and `QueryBus`. After Task 4, nothing injects `EventBus`
  and nothing uses `@EventsHandler`/`IEventHandler`.
- Nothing in any `domain/` folder imports the new port or decorator.
- Every Prisma access on the write path goes through `txHost.tx`. Read-side repositories (BOM and
  MI report/export/filter/dashboard, audit-log `search`/`filterOptions`/`findChangesByEntryId`)
  stay on `PrismaService`.
- Constructor parameters that Nest injects are written as
  `TransactionHost<TransactionalAdapterPrisma<PrismaService>>` **in full**, never through a type
  alias: TypeScript emits `Object` as decorator metadata for an alias, and DI then fails.
- Final history: two commits on top of the commit `HEAD` pointed at when execution started
  (recorded in `/tmp/audit-trail.base`):
  1. `refactor(backend): write audit entries in the same transaction as the change` — everything
     under `backend/`.
  2. `ci: add the backend integration-test gate` — root `Makefile`, `.github/workflows/ci.yml`,
     root `CLAUDE.md`, `docs/adrs/`.
- `make run-guardrails` (ten checks after this plan) is green before either commit is reported done.
- **Deliberate resolutions of spec ambiguities** (each is also flagged where it applies):
  1. The `ClsModule.forRoot(...)` registration lives in a small framework module,
     `PrismaTransactionsModule`, which `AppModule` imports. The integration suite imports the same
     module, so it tests the exact configuration production runs, rather than a copy.
  2. `DomainEventDispatcher.dispatch` takes `readonly DomainEvent[]` (the framework's own marker
     type that `AggregateRoot.releaseEvents()` returns) instead of `readonly object[]`.
  3. The actor is set in integration cases through the real `ActorContextMiddleware.use()` with a
     JWT signed by the app's own `JwtService`. That is the existing `ActorContext` mechanism, with
     its module-scope `AsyncLocalStorage`, and nothing is overridden.
  4. The integration suite has nine cases: the spec's five, plus the four Review Focus cases
     below. One of those is the ADR 0007 Compliance fitness function, "force the audit repository to
     throw and assert the aggregate row was not persisted".
  5. Migrations for the integration run are applied by the `backend` target itself
     (`npm run db:migrate`, i.e. `prisma migrate deploy`, in the test-stack app container) before
     the suite runs.
  6. `jest.integration.config.ts` reads `package.json`'s `jest` block at load time and overrides
     only what differs, so path aliases stay declared once.
  7. `backend/src/framework/CLAUDE.md` and `backend/src/modules/products/CLAUDE.md` also get small
     updates (spec §5 does not list them, but they would otherwise describe `EventBus` and the
     delegates' own transactions wrongly).
  8. ADR 0007's projector line reference is **correct** (line 62, which is where the `catch` is
     today). Spec §5's "line 63" is the error, so the ADR note corrects only the `$transaction`
     claim.

## Review Focus

These are the failure modes most likely to reach a user that the spec implies but none of its five
integration cases exercises. Each is pinned by a test added in its owning task.

1. **The audit store itself fails** (a DB error on `audit_log_entry` insert). Expected: the command
   fails with 500 and the change is **not** saved. This is ADR 0007's own Compliance fitness
   function, and no spec case forces `record()` to fail. **Pinned by** integration case 6 ("rolls
   back the change when its audit entry cannot be written"), Task 2.
2. **The acting user was deleted mid-request**, so `DisplayNameProvider.getName` throws
   `EntityNotFound`. Expected: the command fails and nothing is saved (spec §3, row 2). **Pinned
   by** integration case 7, Task 2.
3. **A successful composition edit leaves old child rows behind or half-written.** The three
   hand-written delegates lose their own `$transaction`, and the spec only tests the failure path.
   Expected: after a committed edit, exactly the new composition exists. **Pinned by** integration
   case 9, Task 2.
4. **Two requests saving at the same time share a transaction or an actor.** Each
   `withTransaction` creates its own CLS context, and the actor lives in a separate
   `AsyncLocalStorage`. Expected: each change commits with its own entry and its own actor.
   **Pinned by** integration case 8, Task 2.
5. **A handler discovered twice writes two audit entries.** A provider also bound under an alias
   (`useExisting`) appears twice in `DiscoveryService.getProviders()`. Expected: it runs once per
   event. **Pinned by** the dispatcher spec's "dispatches once to a handler that is also bound under
   another token" (Task 1), and by case 1's "exactly one entry" (Task 2).

---

### Task 1: Install the packages and build the framework dispatch and transaction wiring

**Files:**
- Modify: `backend/package.json` and `backend/package-lock.json`, through `npm install` in the
  container only.
- Create: `backend/src/framework/application/domain-event-dispatcher.ts`
- Create: `backend/src/framework/application/domain-event-handler.decorator.ts`
- Modify: `backend/src/framework/application/index.ts`
- Create: `backend/src/framework/infrastructure/events/discovered-domain-event-dispatcher.ts`
- Create: `backend/src/framework/infrastructure/events/discovered-domain-event-dispatcher.spec.ts`
- Create: `backend/src/framework/infrastructure/events/domain-events.module.ts`
- Create: `backend/src/framework/infrastructure/persistence/prisma-transactions.module.ts`
- Modify: `backend/src/framework/infrastructure/index.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: `DomainEvent` (`@framework/domain`), `PrismaModule`/`PrismaService`
  (`framework/infrastructure/persistence`).
- Produces:
  - `abstract class DomainEventDispatcher { abstract dispatch(events: readonly DomainEvent[]): Promise<void> }`
    from `@framework/application`
  - `interface DomainEventHandlerOf<E extends DomainEvent> { handle(event: E): Promise<void> }`
    from `@framework/application`
  - `function DomainEventHandler(event: Type<DomainEvent>)`, a class decorator, from
    `@framework/application`
  - `const DOMAIN_EVENT_HANDLER_METADATA = 'cablan:domain-event-handler'` from
    `@framework/application`
  - `DomainEventsModule` (global, exports `DomainEventDispatcher`) from `@framework/infrastructure`
  - `PrismaTransactionsModule` from `@framework/infrastructure`. It makes
    `TransactionHost<TransactionalAdapterPrisma<PrismaService>>` injectable everywhere.

- [ ] **Step 1: Check the precondition and record a green baseline**

From the repo root:

```bash
test -d backend/src/modules/manufacturing-instructions \
  && test ! -d backend/src/modules/materials \
  && test ! -d backend/src/modules/components \
  && test ! -d backend/src/modules/standard-boms && echo precondition-ok
grep -rn "@materials/\|@components/\|@standard-boms/" backend/src backend/tsconfig.json backend/package.json
make backend/run-unit-tests
make backend/lint-architecture
sha256sum backend/docs/openapi.json backend/docs/openapi.yaml > /tmp/openapi.before.sha256
git rev-parse --short HEAD > /tmp/audit-trail.base   # squash base for Task 7
```

Expected: `precondition-ok`, then no `grep` output, then both targets exit 0. If any of these fails,
stop and report. This plan must not run before the rename and the merge have landed.

- [ ] **Step 2: Install the three packages inside the container**

```bash
make backend/setup
docker compose -f backend/docker-compose.yml run --rm --no-deps app \
  npm install 'nestjs-cls@^7.0.1' '@nestjs-cls/transactional@^4.0.1' '@nestjs-cls/transactional-adapter-prisma@^2.0.1'
git diff --stat backend/package.json backend/package-lock.json
```

Expected: `npm install` succeeds with no peer-dependency error, and `package.json`'s `dependencies`
gains exactly those three entries. The container's bind mount writes `package.json` and
`package-lock.json` straight into the working tree.

Then rebuild, and drop both stacks' containers so that no container keeps a stale anonymous
`node_modules` volume without the new packages:

```bash
make backend/down
make backend/build
```

Expected: both exit 0.

- [ ] **Step 3: Write the failing dispatcher spec**

Create `backend/src/framework/infrastructure/events/discovered-domain-event-dispatcher.spec.ts`:

```ts
import {
  DomainEventDispatcher,
  DomainEventHandler,
  DomainEventHandlerOf,
} from '@framework/application';
import { Injectable, Provider } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { DomainEventsModule } from './domain-events.module';

class Shipped {
  constructor(public readonly id: string) {}
}

class Cancelled {
  constructor(public readonly id: string) {}
}

class NobodyListens {}

@Injectable()
class Journal {
  readonly lines: string[] = [];
}

@DomainEventHandler(Shipped)
class SlowShippedHandler implements DomainEventHandlerOf<Shipped> {
  constructor(private readonly journal: Journal) {}

  async handle(event: Shipped): Promise<void> {
    this.journal.lines.push(`slow started ${event.id}`);
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    this.journal.lines.push(`slow finished ${event.id}`);
  }
}

@DomainEventHandler(Shipped)
class FastShippedHandler implements DomainEventHandlerOf<Shipped> {
  constructor(private readonly journal: Journal) {}

  handle(event: Shipped): Promise<void> {
    this.journal.lines.push(`fast ${event.id}`);
    return Promise.resolve();
  }
}

@DomainEventHandler(Cancelled)
class CancelledHandler implements DomainEventHandlerOf<Cancelled> {
  constructor(private readonly journal: Journal) {}

  handle(event: Cancelled): Promise<void> {
    this.journal.lines.push(`cancelled ${event.id}`);
    return Promise.resolve();
  }
}

@DomainEventHandler(Shipped)
class FailingShippedHandler implements DomainEventHandlerOf<Shipped> {
  handle(): Promise<void> {
    return Promise.reject(new Error('handler failed'));
  }
}

describe('DiscoveredDomainEventDispatcher', () => {
  let moduleRef: TestingModule;

  async function dispatcherWith(handlers: Provider[]) {
    moduleRef = await Test.createTestingModule({
      imports: [DomainEventsModule],
      providers: [Journal, ...handlers],
    }).compile();
    await moduleRef.init();
    return {
      dispatcher: moduleRef.get(DomainEventDispatcher),
      journal: moduleRef.get(Journal),
    };
  }

  afterEach(async () => {
    await moduleRef?.close();
  });

  it('runs every handler registered for an event class, and only those', async () => {
    const { dispatcher, journal } = await dispatcherWith([
      SlowShippedHandler,
      FastShippedHandler,
      CancelledHandler,
    ]);

    await dispatcher.dispatch([new Shipped('1')]);

    expect(journal.lines).toEqual([
      'slow started 1',
      'slow finished 1',
      'fast 1',
    ]);
  });

  it('runs handlers one at a time, in event order and then registration order', async () => {
    const { dispatcher, journal } = await dispatcherWith([
      SlowShippedHandler,
      FastShippedHandler,
      CancelledHandler,
    ]);

    await dispatcher.dispatch([
      new Shipped('1'),
      new Cancelled('2'),
      new Shipped('3'),
    ]);

    expect(journal.lines).toEqual([
      'slow started 1',
      'slow finished 1',
      'fast 1',
      'cancelled 2',
      'slow started 3',
      'slow finished 3',
      'fast 3',
    ]);
  });

  it('treats an event nobody handles as a no-op', async () => {
    const { dispatcher, journal } = await dispatcherWith([FastShippedHandler]);

    await expect(
      dispatcher.dispatch([new NobodyListens()]),
    ).resolves.toBeUndefined();
    expect(journal.lines).toEqual([]);
  });

  it('propagates the first failure and runs nothing after it', async () => {
    const { dispatcher, journal } = await dispatcherWith([
      FailingShippedHandler,
      FastShippedHandler,
      CancelledHandler,
    ]);

    await expect(
      dispatcher.dispatch([new Shipped('1'), new Cancelled('2')]),
    ).rejects.toThrow('handler failed');
    expect(journal.lines).toEqual([]);
  });

  it('dispatches once to a handler that is also bound under another token', async () => {
    const { dispatcher, journal } = await dispatcherWith([
      FastShippedHandler,
      { provide: 'FAST_SHIPPED_ALIAS', useExisting: FastShippedHandler },
    ]);

    await dispatcher.dispatch([new Shipped('1')]);

    expect(journal.lines).toEqual(['fast 1']);
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

```bash
make backend/run-unit-tests
```

Expected: FAIL. The new suite cannot compile: `Module '"@framework/application"' has no exported
member 'DomainEventDispatcher'` and `Cannot find module './domain-events.module'`. Every other
suite still passes.

- [ ] **Step 5: Write the port and the decorator**

Create `backend/src/framework/application/domain-event-dispatcher.ts`:

```ts
import { DomainEvent } from '@framework/domain';

/**
 * Delivers an aggregate's released domain events to every subscriber, and
 * resolves only once they have all finished. `PrismaEntityRepository`
 * calls it inside the aggregate write's transaction, so a subscriber's
 * failure rolls the write back (ADR 0007). Events go out in order, and
 * each event's handlers run one at a time, so one transaction client is
 * never used concurrently. An event with no handler is a no-op, and the
 * first error propagates.
 */
export abstract class DomainEventDispatcher {
  abstract dispatch(events: readonly DomainEvent[]): Promise<void>;
}
```

Create `backend/src/framework/application/domain-event-handler.decorator.ts`:

```ts
import { DomainEvent } from '@framework/domain';
import { applyDecorators, Injectable, SetMetadata, Type } from '@nestjs/common';

export const DOMAIN_EVENT_HANDLER_METADATA = 'cablan:domain-event-handler';

/** What a `@DomainEventHandler(E)` provider implements. */
export interface DomainEventHandlerOf<E extends DomainEvent> {
  handle(event: E): Promise<void>;
}

/**
 * Subscribes a provider to one domain-event class. `DomainEventDispatcher`
 * awaits its `handle(event)` for every dispatched event whose constructor
 * is exactly `event`. Replaces `@nestjs/cqrs`' `@EventsHandler` for domain
 * events: that bus cannot be awaited and cannot fail its publisher. The
 * provider must still be listed in its module's `providers`.
 */
export function DomainEventHandler(event: Type<DomainEvent>) {
  return applyDecorators(
    Injectable(),
    SetMetadata(DOMAIN_EVENT_HANDLER_METADATA, event),
  );
}
```

Append to `backend/src/framework/application/index.ts`:

```ts
export { DomainEventDispatcher } from './domain-event-dispatcher';
export type { DomainEventHandlerOf } from './domain-event-handler.decorator';
export {
  DOMAIN_EVENT_HANDLER_METADATA,
  DomainEventHandler,
} from './domain-event-handler.decorator';
```

- [ ] **Step 6: Write the discovering implementation and its module**

Create `backend/src/framework/infrastructure/events/discovered-domain-event-dispatcher.ts`:

```ts
import {
  DOMAIN_EVENT_HANDLER_METADATA,
  DomainEventDispatcher,
  DomainEventHandlerOf,
} from '@framework/application';
import { DomainEvent } from '@framework/domain';
import { Injectable, OnModuleInit, Type } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';

/**
 * Finds every `@DomainEventHandler` provider once, when the module
 * initialises. By then Nest has created every static provider. It then
 * awaits them per event, one at a time.
 *
 * Only static (singleton) providers are considered. A provider bound a
 * second time with `useExisting` is a factory wrapper whose metatype
 * carries no handler metadata, so it is never registered twice.
 */
@Injectable()
export class DiscoveredDomainEventDispatcher
  extends DomainEventDispatcher
  implements OnModuleInit
{
  private readonly handlersByEvent = new Map<
    unknown,
    DomainEventHandlerOf<DomainEvent>[]
  >();

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
  ) {
    super();
  }

  onModuleInit(): void {
    for (const wrapper of this.discovery.getProviders()) {
      const { instance, metatype } = wrapper;
      if (!instance || !metatype || !wrapper.isDependencyTreeStatic()) {
        continue;
      }
      const eventType = this.reflector.get<Type<DomainEvent> | undefined>(
        DOMAIN_EVENT_HANDLER_METADATA,
        metatype,
      );
      if (eventType === undefined) {
        continue;
      }
      const handlers = this.handlersByEvent.get(eventType) ?? [];
      handlers.push(instance as DomainEventHandlerOf<DomainEvent>);
      this.handlersByEvent.set(eventType, handlers);
    }
  }

  async dispatch(events: readonly DomainEvent[]): Promise<void> {
    for (const event of events) {
      for (const handler of this.handlersByEvent.get(event.constructor) ?? []) {
        await handler.handle(event);
      }
    }
  }
}
```

Create `backend/src/framework/infrastructure/events/domain-events.module.ts`:

```ts
import { DomainEventDispatcher } from '@framework/application';
import { Global, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { DiscoveredDomainEventDispatcher } from './discovered-domain-event-dispatcher';

// Global for the same reason as `ClockModule`: every module's repository
// depends on the `DomainEventDispatcher` port through
// `PrismaEntityRepository`, and only this module binds it.
@Global()
@Module({
  imports: [DiscoveryModule],
  providers: [
    {
      provide: DomainEventDispatcher,
      useClass: DiscoveredDomainEventDispatcher,
    },
  ],
  exports: [DomainEventDispatcher],
})
export class DomainEventsModule {}
```

- [ ] **Step 7: Run the spec to verify it passes**

```bash
make backend/run-unit-tests
```

Expected: PASS, with all 5 new tests green and the suite count equal to the baseline plus 5.

- [ ] **Step 8: Write the transaction wiring module and register both modules**

Create `backend/src/framework/infrastructure/persistence/prisma-transactions.module.ts`:

```ts
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Module } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';

import { PrismaModule } from './prisma.module';
import { PrismaService } from './prisma.service';

/**
 * The ambient Prisma transaction (ADR 0007). Registers `nestjs-cls`
 * globally with the transactional plugin, which makes
 * `TransactionHost<TransactionalAdapterPrisma<PrismaService>>` injectable
 * everywhere:
 *
 * - `txHost.withTransaction(fn)` opens an interactive transaction, or
 *   joins the open one (default propagation `Required`). It creates a CLS
 *   context when none is active, so a save outside any request (e.g.
 *   `DefaultAdminSeeder` at boot) works too.
 * - `txHost.tx` is the transaction client inside one, and the plain
 *   `PrismaService` outside.
 *
 * A module of its own, rather than inline in `AppModule`, so the backend
 * integration suite imports exactly this configuration.
 */
@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
      plugins: [
        new ClsPluginTransactional({
          imports: [PrismaModule],
          adapter: new TransactionalAdapterPrisma<PrismaService>({
            prismaInjectionToken: PrismaService,
          }),
        }),
      ],
    }),
  ],
})
export class PrismaTransactionsModule {}
```

Add to `backend/src/framework/infrastructure/index.ts`, next to the other module exports:

```ts
export { DomainEventsModule } from './events/domain-events.module';
export { PrismaTransactionsModule } from './persistence/prisma-transactions.module';
```

In `backend/src/app.module.ts`:
- Add `DomainEventsModule` and `PrismaTransactionsModule` to the `@framework/infrastructure` import.
- In `imports`, insert both directly after `PrismaModule`:

  ```ts
      PrismaModule,
      PrismaTransactionsModule,
      DomainEventsModule,
  ```

- Replace the comment above `CqrsModule.forRoot()` with:

  ```ts
      // `.forRoot()` (rather than a bare `CqrsModule` import) is what marks the
      // module `global: true`, so CommandBus/QueryBus resolve in every feature
      // module and in TestingModule without each one re-importing it. Domain
      // events do not use its EventBus: they go through `DomainEventDispatcher`
      // (`DomainEventsModule`), inside the write's transaction — ADR 0007.
  ```

- [ ] **Step 9: Verify the wiring boots and nothing else moved**

```bash
make backend/run-unit-tests
make backend/lint-architecture
make backend/lint-swagger
make backend/lint
```

Expected: all exit 0. `lint-swagger` boots the whole `AppModule` with `app.init()` and no database,
which proves the CLS plugin and the dispatcher's discovery initialise without querying. If
`make backend/lint` fails only on formatting or import order, run `make backend/fix-lint` and re-run
it.

- [ ] **Step 10: Commit**

```bash
git add -A backend
git commit -m "wip: add domain-event dispatcher and transaction wiring"
```

---

### Task 2: Add the integration gate and its cases, failing first

**Files:**
- Create: `backend/jest.integration.config.ts`
- Modify: `backend/package.json` (`scripts`: add `test:integration`)
- Modify: `backend/Makefile` (new target `run-integration-tests`, `.PHONY`)
- Create: `backend/test/integration/transactional-audit-trail.int-spec.ts`

**Interfaces:**
- Consumes (Task 1): `DomainEventHandler`, `DomainEventHandlerOf` (`@framework/application`),
  `DomainEventsModule`, `PrismaTransactionsModule` (`@framework/infrastructure`).
- Consumes (existing): `ActorContextMiddleware`, `ActorContextModule`, `AuthModule`, `ClockModule`,
  `EmailModule`, `PrismaModule`, `PrismaService` (`@framework/infrastructure`); `IdentityModule`;
  `ProductsModule`; `AuditLoggingModule`; `AuditLogRepository`; `MaterialRepository`,
  `ProductRepository`; `Material`, `Product`, `MaterialName`, `ProductName`,
  `ProductComponentLine`, `ProductMaterialLine`; `MaterialRegistered`, `MaterialDeleted`,
  `ProductComponentsUpdated`.
- Produces: `make backend/run-integration-tests` (used by Task 6's root target) and
  `npm run test:integration`.

- [ ] **Step 1: Add the Jest config, the script and the Make target**

Create `backend/jest.integration.config.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Config } from 'jest';

// The unit suite's config is package.json's "jest" block (rootDir `src`).
// Reusing it keeps the path aliases (moduleNameMapper) and the ts-jest
// transform declared once; only where to look and what to match differ.
const { jest: unitConfig } = JSON.parse(
  readFileSync(join(__dirname, 'package.json'), 'utf8'),
) as { jest: Config };

const config: Config = {
  ...unitConfig,
  roots: ['<rootDir>/../test/integration'],
  testRegex: String.raw`.*\.int-spec\.ts$`,
  collectCoverageFrom: [],
  // One shared Postgres: run files one at a time.
  maxWorkers: 1,
  testTimeout: 30_000,
};

export default config;
```

In `backend/package.json` `scripts`, directly after `"test:debug"`:

```json
    "test:integration": "jest --config jest.integration.config.ts",
```

In `backend/Makefile`, add `run-integration-tests` to the `.PHONY` line, and add this target
directly after `run-unit-tests`:

```make
# The one backend check that needs a database. It runs in the test stack's app container, against
# that stack's Postgres, which test-up starts. It migrates first, because nothing else migrates the
# test stack before an acceptance run. The suite never truncates: each case deletes its own rows.
run-integration-tests: test-up ## Run the Jest integration tests against the test stack's database
	$(COMPOSE_TEST) exec -T app npm run db:migrate
	$(COMPOSE_TEST) exec -T app npm run test:integration
```

(The recipe lines are indented with a **tab**.)

- [ ] **Step 2: Write the integration cases**

Create `backend/test/integration/transactional-audit-trail.int-spec.ts`:

```ts
import { randomUUID } from 'node:crypto';

import { AuditLogRepository } from '@audit-logging/application/service/audit-log.repository';
import { AuditLoggingModule } from '@audit-logging/infrastructure/audit-logging.module';
import {
  DomainEventHandler,
  DomainEventHandlerOf,
} from '@framework/application';
import { EntityNotFound, Identity, Role } from '@framework/domain';
import {
  ActorContextMiddleware,
  ActorContextModule,
  AuthModule,
  ClockModule,
  DomainEventsModule,
  EmailModule,
  PrismaModule,
  PrismaService,
  PrismaTransactionsModule,
} from '@framework/infrastructure';
import { IdentityModule } from '@identity/infrastructure/identity.module';
import { Injectable } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { MaterialDeleted } from '@products/domain/events/material-deleted.event';
import { MaterialRegistered } from '@products/domain/events/material-registered.event';
import { ProductComponentsUpdated } from '@products/domain/events/product-components-updated.event';
import { Material } from '@products/domain/material.aggregate';
import { Product } from '@products/domain/product.aggregate';
import { MaterialRepository } from '@products/domain/service/material.repository';
import { ProductRepository } from '@products/domain/service/product.repository';
import { MaterialName } from '@products/domain/value/material-name.vo';
import { ProductComponentLine } from '@products/domain/value/product-component-line.vo';
import { ProductMaterialLine } from '@products/domain/value/product-material-line.vo';
import { ProductName } from '@products/domain/value/product-name.vo';
import { ProductsModule } from '@products/infrastructure/products.module';
import { Request, Response } from 'express';

// ADR 0007: an aggregate's change and its audit entry commit or roll back
// together. Runs against the test stack's real Postgres (see
// `make run-integration-tests`). Every case uses fresh ids and unique
// names and deletes its own rows; nothing truncates.

const TRIPWIRE_FAILURE = 'tripwire: a subscriber failed';
// Stored in app_user.password_hash for the test actors; never used to log in.
const UNUSABLE_HASH = 'not-a-bcrypt-hash';

/** A switch the extra subscribers below consult: they fail only when armed. */
@Injectable()
class Tripwire {
  private armed = false;

  arm(): void {
    this.armed = true;
  }

  disarm(): void {
    this.armed = false;
  }

  check(): Promise<void> {
    return this.armed
      ? Promise.reject(new Error(TRIPWIRE_FAILURE))
      : Promise.resolve();
  }
}

@DomainEventHandler(MaterialRegistered)
class MaterialRegisteredTripwire
  implements DomainEventHandlerOf<MaterialRegistered>
{
  constructor(private readonly tripwire: Tripwire) {}

  handle(): Promise<void> {
    return this.tripwire.check();
  }
}

@DomainEventHandler(MaterialDeleted)
class MaterialDeletedTripwire implements DomainEventHandlerOf<MaterialDeleted> {
  constructor(private readonly tripwire: Tripwire) {}

  handle(): Promise<void> {
    return this.tripwire.check();
  }
}

@DomainEventHandler(ProductComponentsUpdated)
class ProductComponentsUpdatedTripwire
  implements DomainEventHandlerOf<ProductComponentsUpdated>
{
  constructor(private readonly tripwire: Tripwire) {}

  handle(): Promise<void> {
    return this.tripwire.check();
  }
}

function compositionLine(
  componentName: string,
  materialName: string,
): ProductComponentLine {
  return ProductComponentLine.of(Identity.new(), componentName, [
    ProductMaterialLine.of(Identity.new(), materialName),
  ]);
}

interface Actor {
  readonly id: string;
  readonly name: string;
}

describe('transactional audit trail', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let materials: MaterialRepository;
  let products: ProductRepository;
  let auditLog: AuditLogRepository;
  let tripwire: Tripwire;
  let jwt: JwtService;
  let actorMiddleware: ActorContextMiddleware;
  // Assigned in beforeAll, before any case runs.
  let actor: Actor;
  let otherActor: Actor;
  let createdMaterialIds: string[] = [];
  let createdProductIds: string[] = [];

  // Runs `work` the way a request does: through the real
  // ActorContextMiddleware, carrying a bearer token whose `sub` is `userId`.
  // Everything `work` awaits inherits that actor.
  function runAs<T>(userId: string, work: () => Promise<T>): Promise<T> {
    const request = {
      headers: { authorization: `Bearer ${jwt.sign({ sub: userId })}` },
    } as unknown as Request;
    return new Promise<T>((resolve, reject) => {
      actorMiddleware.use(request, {} as Response, () => {
        work().then(resolve, reject);
      });
    });
  }

  async function createActor(): Promise<Actor> {
    const id = randomUUID();
    const name = `Integration actor ${id}`;
    await prisma.user.create({
      data: {
        id,
        name,
        username: `integration-${id}`,
        passwordHash: UNUSABLE_HASH,
        role: Role.SystemAdmin,
      },
    });
    return { id, name };
  }

  function newMaterial(): Material {
    const material = Material.register(
      MaterialName.fromString(`Integration material ${randomUUID()}`),
      null,
    );
    createdMaterialIds.push(material.id.asString());
    return material;
  }

  async function savedProduct(): Promise<Product> {
    const product = Product.register(
      ProductName.fromString(`Integration product ${randomUUID()}`),
      [compositionLine('Core', 'Copper')],
    );
    createdProductIds.push(product.id.asString());
    await products.save(product);
    return product;
  }

  function materialRow(material: Material) {
    return prisma.material.findUnique({
      where: { id: material.id.asString() },
    });
  }

  function auditEntriesFor(recordId: string) {
    return prisma.auditLogEntry.findMany({ where: { recordId } });
  }

  async function compositionOf(productId: string) {
    const rows = await prisma.productComponent.findMany({
      where: { productId },
      include: { materials: { orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    });
    return rows.map((row) => ({
      name: row.name,
      materials: row.materials.map((material) => material.name),
    }));
  }

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        // The container's environment (.env.test via Compose) is the config.
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        CqrsModule.forRoot(),
        AuthModule,
        ActorContextModule,
        ClockModule,
        EmailModule,
        PrismaModule,
        PrismaTransactionsModule,
        DomainEventsModule,
        IdentityModule,
        ProductsModule,
        AuditLoggingModule,
      ],
      providers: [
        Tripwire,
        MaterialRegisteredTripwire,
        MaterialDeletedTripwire,
        ProductComponentsUpdatedTripwire,
      ],
    }).compile();
    await moduleRef.init();

    prisma = moduleRef.get(PrismaService, { strict: false });
    materials = moduleRef.get(MaterialRepository, { strict: false });
    products = moduleRef.get(ProductRepository, { strict: false });
    auditLog = moduleRef.get(AuditLogRepository, { strict: false });
    tripwire = moduleRef.get(Tripwire, { strict: false });
    jwt = moduleRef.get(JwtService, { strict: false });
    actorMiddleware = moduleRef.get(ActorContextMiddleware, { strict: false });

    actor = await createActor();
    otherActor = await createActor();
  });

  afterEach(async () => {
    tripwire.disarm();
    jest.restoreAllMocks();
    await prisma.auditLogEntry.deleteMany({
      where: { recordId: { in: [...createdMaterialIds, ...createdProductIds] } },
    });
    await prisma.material.deleteMany({
      where: { id: { in: createdMaterialIds } },
    });
    await prisma.product.deleteMany({
      where: { id: { in: createdProductIds } },
    });
    createdMaterialIds = [];
    createdProductIds = [];
  });

  afterAll(async () => {
    const actorIds = [actor?.id, otherActor?.id].filter(
      (id): id is string => id !== undefined,
    );
    await prisma?.user.deleteMany({ where: { id: { in: actorIds } } });
    await moduleRef?.close();
  });

  // Case 1 (spec): commit.
  it('commits the change and exactly one audit entry for it, stamped with the actor', async () => {
    const material = newMaterial();

    await runAs(actor.id, () => materials.save(material));

    expect(await materialRow(material)).not.toBeNull();
    expect(await auditEntriesFor(material.id.asString())).toEqual([
      expect.objectContaining({
        recordType: 'Material',
        action: 'Registered',
        actorId: actor.id,
        actorName: actor.name,
      }),
    ]);
  });

  // Case 2 (spec): save rolls back.
  it('rolls back a new row and its audit entry when a subscriber fails during save', async () => {
    const material = newMaterial();
    tripwire.arm();

    await expect(
      runAs(actor.id, () => materials.save(material)),
    ).rejects.toThrow(TRIPWIRE_FAILURE);

    expect(await materialRow(material)).toBeNull();
    expect(await auditEntriesFor(material.id.asString())).toEqual([]);
  });

  // Case 3 (spec): delete rolls back.
  it('keeps the row when a subscriber fails during delete', async () => {
    const material = newMaterial();
    await materials.save(material);
    const stored = await materials.get(material.id);
    stored.delete();
    tripwire.arm();

    await expect(
      runAs(actor.id, () => materials.delete(stored)),
    ).rejects.toThrow(TRIPWIRE_FAILURE);

    expect(await materialRow(material)).not.toBeNull();
    expect(await auditEntriesFor(material.id.asString())).toEqual([]);
  });

  // Case 4 (spec): nested write rolls back.
  it('keeps the original composition rows when a subscriber fails while replacing them', async () => {
    const product = await savedProduct();
    const stored = await products.get(product.id);
    stored.updateComponents([compositionLine('Sheath', 'PVC')]);
    tripwire.arm();

    await expect(
      runAs(actor.id, () => products.save(stored)),
    ).rejects.toThrow(TRIPWIRE_FAILURE);

    expect(await compositionOf(product.id.asString())).toEqual([
      { name: 'Core', materials: ['Copper'] },
    ]);
  });

  // Case 5 (spec): no actor. Runs outside any request and any CLS context,
  // which is exactly how DefaultAdminSeeder saves at boot.
  it('commits a change made with no actor, and writes no audit entry for it', async () => {
    const material = newMaterial();

    await materials.save(material);

    expect(await materialRow(material)).not.toBeNull();
    expect(await auditEntriesFor(material.id.asString())).toEqual([]);
  });

  // Case 6 (Review Focus 1; ADR 0007's Compliance fitness function).
  it('rolls back the change when its audit entry cannot be written', async () => {
    const material = newMaterial();
    jest
      .spyOn(auditLog, 'record')
      .mockRejectedValueOnce(new Error('audit store unavailable'));

    await expect(
      runAs(actor.id, () => materials.save(material)),
    ).rejects.toThrow('audit store unavailable');

    expect(await materialRow(material)).toBeNull();
  });

  // Case 7 (Review Focus 2): the actor was deleted mid-request.
  it('rolls back the change when the actor no longer exists', async () => {
    const material = newMaterial();

    await expect(
      runAs(randomUUID(), () => materials.save(material)),
    ).rejects.toBeInstanceOf(EntityNotFound);

    expect(await materialRow(material)).toBeNull();
    expect(await auditEntriesFor(material.id.asString())).toEqual([]);
  });

  // Case 8 (Review Focus 4): concurrent requests stay apart.
  it('keeps concurrent saves in separate transactions, each with its own actor', async () => {
    const first = newMaterial();
    const second = newMaterial();

    await Promise.all([
      runAs(actor.id, () => materials.save(first)),
      runAs(otherActor.id, () => materials.save(second)),
    ]);

    expect(await auditEntriesFor(first.id.asString())).toEqual([
      expect.objectContaining({ actorId: actor.id }),
    ]);
    expect(await auditEntriesFor(second.id.asString())).toEqual([
      expect.objectContaining({ actorId: otherActor.id }),
    ]);
  });

  // Case 9 (Review Focus 3): the delegates' delete-and-recreate, now on the
  // repository's transaction, still replaces the composition in full.
  it('replaces the composition rows in full when an edit commits', async () => {
    const product = await savedProduct();
    const stored = await products.get(product.id);
    stored.updateComponents([
      compositionLine('Sheath', 'PVC'),
      compositionLine('Jacket', 'Rubber'),
    ]);

    await runAs(actor.id, () => products.save(stored));

    expect(await compositionOf(product.id.asString())).toEqual([
      { name: 'Jacket', materials: ['Rubber'] },
      { name: 'Sheath', materials: ['PVC'] },
    ]);
  });
});
```

`afterAll` reads `actor?.id`, `prisma?.` and `moduleRef?.`, so if `beforeAll` failed part-way, the
cleanup does not throw a second, misleading error.

- [ ] **Step 3: Run the suite to verify the rollback cases fail**

```bash
make backend/run-integration-tests
```

Expected: the target starts the test stack, migrates it, and runs 9 tests. At least cases 2, 3, 4,
6 and 7 FAIL, because repositories still publish fire-and-forget through `EventBus`, so `save`
resolves and the row is committed. Cases 5 and 9 PASS. Cases 1 and 8 may pass or fail: they race
the fire-and-forget projection, so don't rely on either result. If the module fails to **compile**
with an unresolved dependency, add the missing module from `AppModule`'s import list to `imports`
(never a mock) and re-run.

- [ ] **Step 4: Lint the new files**

```bash
make backend/lint
```

Expected: exit 0. `make backend/lint` covers `test/**/*.ts`. If it fails on formatting or import
order only, run `make backend/fix-lint` and re-run.

- [ ] **Step 5: Commit**

```bash
git add -A backend
git commit -m "wip: add the backend integration gate with failing atomicity cases"
```

---

### Task 3: Move every write-path Prisma access onto the ambient transaction

**Files:**
- Modify: `backend/src/framework/infrastructure/persistence/prisma.repository.ts`
- Modify: `backend/src/modules/products/infrastructure/persistence/material.repository.ts`
- Modify: `backend/src/modules/products/infrastructure/persistence/component.repository.ts`
- Modify: `backend/src/modules/products/infrastructure/persistence/product.repository.ts`
- Modify: `backend/src/modules/identity/infrastructure/persistence/user.repository.ts`
- Modify: `backend/src/modules/manufacturing-instructions/infrastructure/persistence/manufacturing-instruction.repository.ts`
- Modify: `backend/src/modules/boms/infrastructure/persistence/bom.repository.ts`

**Interfaces:**
- Consumes (Task 1): `DomainEventDispatcher` (`@framework/application`); the globally injectable
  `TransactionHost` (`@nestjs-cls/transactional`) with `TransactionalAdapterPrisma`
  (`@nestjs-cls/transactional-adapter-prisma`).
- Produces: the new `PrismaEntityRepository` contract, which Task 4 relies on:
  - `constructor(txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>, dispatcher: DomainEventDispatcher)`
  - `protected readonly txHost`
  - `protected abstract delegate(): ModelDelegate<PModel>`, read from `this.txHost.tx` on every call
  - `save()`/`delete()` each run as
    `txHost.withTransaction(write → await dispatcher.dispatch(entity.releaseEvents()))`
  - `ModelDelegate<PModel>` is unchanged.

- [ ] **Step 1: Rewrite `PrismaEntityRepository`**

Replace `backend/src/framework/infrastructure/persistence/prisma.repository.ts` with:

```ts
import { DomainEventDispatcher } from '@framework/application';
import {
  AggregateRoot,
  EntityNotFound,
  EntityRepository,
  Identity,
} from '@framework/domain';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';

import { PrismaService } from './prisma.service';

export interface ModelDelegate<PModel> {
  findUnique(args: { where: { id: string } }): Promise<PModel | null>;
  upsert(args: {
    where: { id: string };
    create: PModel;
    update: Omit<PModel, 'id'>;
  }): Promise<PModel>;
  delete(args: { where: { id: string } }): Promise<PModel>;
}

/**
 * Writes an aggregate and delivers its released domain events in **one**
 * Postgres transaction (ADR 0007). `save()`/`delete()` open it with
 * `txHost.withTransaction()`, joining any transaction already open, then
 * write through `delegate()` and await `DomainEventDispatcher.dispatch()`.
 * A subscriber's failure (e.g. the audit projection) rolls the write back.
 *
 * Every Prisma access a subclass makes must go through `this.txHost.tx`
 * (the transaction client inside one, plain `PrismaService` outside), never
 * an injected `PrismaService`, or it runs on another connection outside the
 * transaction.
 */
export abstract class PrismaEntityRepository<
  T extends AggregateRoot,
  PModel extends { id: string },
> extends EntityRepository<T> {
  constructor(
    protected readonly txHost: TransactionHost<
      TransactionalAdapterPrisma<PrismaService>
    >,
    private readonly dispatcher: DomainEventDispatcher,
  ) {
    super();
  }

  /**
   * This aggregate's delegate, built from `this.txHost.tx` on **every**
   * call. Never cache it: the transaction client differs per transaction.
   */
  protected abstract delegate(): ModelDelegate<PModel>;
  protected abstract toDomain(record: PModel): T;
  protected abstract toPersistence(entity: T): PModel;

  async find(id: Identity): Promise<T | null> {
    const record = await this.delegate().findUnique({
      where: { id: id.asString() },
    });
    return record ? this.toDomain(record) : null;
  }

  async get(id: Identity): Promise<T> {
    const entity = await this.find(id);
    if (!entity) throw EntityNotFound.withId(id);
    return entity;
  }

  async save(entity: T): Promise<void> {
    const data = this.toPersistence(entity);
    const { id, ...updateData } = data;
    await this.txHost.withTransaction(async () => {
      await this.delegate().upsert({
        where: { id },
        create: data,
        update: updateData,
      });
      await this.dispatcher.dispatch(entity.releaseEvents());
    });
  }

  /**
   * Hard delete: removes the row outright rather than upserting a flag.
   * Not part of the abstract `EntityRepository` base — most aggregates
   * (e.g. `User`) soft-delete through the ordinary `save()` upsert instead,
   * so this is opt-in per module port (see `MaterialRepository`).
   */
  async delete(entity: T): Promise<void> {
    await this.txHost.withTransaction(async () => {
      await this.delegate().delete({ where: { id: entity.id.asString() } });
      await this.dispatcher.dispatch(entity.releaseEvents());
    });
  }
}
```

- [ ] **Step 2: Convert the three generated-delegate repositories**

Replace `backend/src/modules/products/infrastructure/persistence/material.repository.ts` with:

```ts
import { DomainEventDispatcher } from '@framework/application';
import {
  ModelDelegate,
  PrismaEntityRepository,
  PrismaService,
} from '@framework/infrastructure';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable } from '@nestjs/common';
import { Material } from '@products/domain/material.aggregate';
import { MaterialRepository } from '@products/domain/service/material.repository';
import { MaterialName } from '@products/domain/value/material-name.vo';

import { MaterialMapper, MaterialRecord } from './material.mapper';

@Injectable()
export class PrismaMaterialRepository
  extends PrismaEntityRepository<Material, MaterialRecord>
  implements MaterialRepository
{
  constructor(
    txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    dispatcher: DomainEventDispatcher,
  ) {
    super(txHost, dispatcher);
  }

  protected delegate(): ModelDelegate<MaterialRecord> {
    return this.txHost.tx.material;
  }

  protected toDomain(record: MaterialRecord): Material {
    return MaterialMapper.toDomain(record);
  }

  protected toPersistence(entity: Material): MaterialRecord {
    return MaterialMapper.toPersistence(entity);
  }

  async findByName(name: MaterialName): Promise<Material | null> {
    const record = await this.txHost.tx.material.findUnique({
      where: { name: name.asString() },
    });
    return record ? this.toDomain(record) : null;
  }

  async list(): Promise<Material[]> {
    const records = await this.txHost.tx.material.findMany();
    return records.map((record) => this.toDomain(record));
  }
}
```

Apply the same five edits to
`backend/src/modules/products/infrastructure/persistence/component.repository.ts`
(`PrismaComponentRepository`) and
`backend/src/modules/identity/infrastructure/persistence/user.repository.ts`
(`PrismaUserRepository`):

1. Imports:
   - remove `EventBus` from `@nestjs/cqrs`;
   - add `DomainEventDispatcher` from `@framework/application`, `TransactionHost` from
     `@nestjs-cls/transactional` and `TransactionalAdapterPrisma` from
     `@nestjs-cls/transactional-adapter-prisma`;
   - add `ModelDelegate` to the `@framework/infrastructure` import, and keep `PrismaService` there,
     since it is used in the type argument.
2. The constructor becomes exactly the material one above: two parameters, no
   `private readonly prisma`, then `super(txHost, dispatcher)`.
3. Add `delegate()`:
   - component: `protected delegate(): ModelDelegate<ComponentRecord> { return this.txHost.tx.component; }`
   - user: `protected delegate(): ModelDelegate<PrismaUser> { return this.txHost.tx.user; }`
4. Every remaining `this.prisma.<model>` becomes `this.txHost.tx.<model>`:
   - component: `findByName`, `list`;
   - user: `findByUsername`, `list`.
   Query arguments stay as they are.
5. Nothing else changes.

`PrismaUserRepository` must be on `txHost.tx`: `IdentityDisplayNameProvider.getName()` calls its
`get()` from inside the audit projection, so it reads in the write's transaction.

- [ ] **Step 3: Convert the product delegate (shown in full)**

In `backend/src/modules/products/infrastructure/persistence/product.repository.ts`, keep
`ProductWithComposition`, `COMPOSITION_INCLUDE`, `toRecord` and `toNestedCreate` exactly as they are.
Change the imports to:

```ts
import { DomainEventDispatcher } from '@framework/application';
import {
  ModelDelegate,
  PrismaEntityRepository,
  PrismaService,
} from '@framework/infrastructure';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Product } from '@products/domain/product.aggregate';
import { ProductRepository } from '@products/domain/service/product.repository';
```

and replace the `ProductDelegate` class and the `PrismaProductRepository` class with:

```ts
/**
 * `ModelDelegate<ProductRecord>` implemented by hand rather than returned
 * as `tx.product` directly, unlike `PrismaComponentRepository`/
 * `PrismaMaterialRepository`: a product's aggregate spans three tables
 * (`product`, `product_component`, `product_material`), so this adapter is
 * what loads/saves the nested shape `ProductMapper` expects. See
 * `src/modules/products/CLAUDE.md`.
 *
 * Built per call from `txHost.tx`, so it never opens a transaction of its
 * own: `upsert` runs inside the one `PrismaEntityRepository.save()` opened,
 * and its delete-and-recreate commits or rolls back with the product's
 * events' subscribers (ADR 0007).
 */
class ProductDelegate implements ModelDelegate<ProductRecord> {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async findUnique(args: {
    where: { id: string };
  }): Promise<ProductRecord | null> {
    const record = await this.db.product.findUnique({
      where: args.where,
      include: COMPOSITION_INCLUDE,
    });
    return record ? toRecord(record) : null;
  }

  async upsert(args: {
    where: { id: string };
    create: ProductRecord;
    update: Omit<ProductRecord, 'id'>;
  }): Promise<ProductRecord> {
    const { where, create, update } = args;
    // `Product.updateComponents()` discards the previous composition in
    // full rather than merging with it — this mirrors that literally,
    // deleting the product's existing `product_component` rows (cascading
    // to `product_material`) before recreating the composition the
    // aggregate now holds. A no-op the first time a product is saved,
    // since nothing yet references its (not-yet-existing) id.
    await this.db.productComponent.deleteMany({
      where: { productId: where.id },
    });
    const saved = await this.db.product.upsert({
      where,
      create: {
        id: create.id,
        name: create.name,
        components: { create: toNestedCreate(create.components) },
      },
      update: {
        name: update.name,
        components: { create: toNestedCreate(update.components) },
      },
      include: COMPOSITION_INCLUDE,
    });
    return toRecord(saved);
  }

  async delete(args: { where: { id: string } }): Promise<ProductRecord> {
    // `onDelete: Cascade` on `product_component`/`product_material` removes
    // the rest of the composition; the master `Component`/`Material` rows
    // those lines point at are untouched — they are standalone aggregates
    // (see `Product.delete()`'s doc comment).
    const record = await this.db.product.delete({
      where: args.where,
      include: COMPOSITION_INCLUDE,
    });
    return toRecord(record);
  }
}

@Injectable()
export class PrismaProductRepository
  extends PrismaEntityRepository<Product, ProductRecord>
  implements ProductRepository
{
  constructor(
    txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    dispatcher: DomainEventDispatcher,
  ) {
    super(txHost, dispatcher);
  }

  protected delegate(): ModelDelegate<ProductRecord> {
    return new ProductDelegate(this.txHost.tx);
  }

  protected toDomain(record: ProductRecord): Product {
    return ProductMapper.toDomain(record);
  }

  protected toPersistence(entity: Product): ProductRecord {
    return ProductMapper.toPersistence(entity);
  }

  async list(): Promise<Product[]> {
    const records = await this.txHost.tx.product.findMany({
      include: COMPOSITION_INCLUDE,
    });
    return records.map((record) => this.toDomain(toRecord(record)));
  }
}
```

If the merge left the `Product.delete()` comment's wording different, keep the current wording and
change only the code.

- [ ] **Step 4: Convert the BOM and MI delegates the same way**

In `backend/src/modules/boms/infrastructure/persistence/bom.repository.ts`:

1. Imports:
   - drop `EventBus` (`@nestjs/cqrs`) and `PrismaClient` (keep `Prisma`);
   - add `DomainEventDispatcher` (`@framework/application`), `TransactionHost`
     (`@nestjs-cls/transactional`) and `TransactionalAdapterPrisma`
     (`@nestjs-cls/transactional-adapter-prisma`);
   - keep `Clock`, `ModelDelegate`, `PrismaEntityRepository` and `PrismaService`.
2. `BomDelegate`'s constructor becomes
   `constructor(private readonly db: Prisma.TransactionClient, private readonly clock: Clock) {}`.
   In `findUnique` and `delete`, change `this.prisma.bom` to `this.db.bom`.
3. Replace `BomDelegate.upsert`'s body. The `$transaction` wrapper goes, and the two statements run
   on `this.db`:

   ```ts
       const { where, create, update } = args;
       // `Bom.edit()` discards the previous composition in full rather than
       // merging with it — this mirrors that literally, deleting the daily
       // BOM's existing `bom_component` rows (cascading to `bom_material`)
       // before recreating the composition the aggregate now holds. Runs on
       // the transaction `PrismaEntityRepository.save()` opened, so both
       // statements commit or roll back together with the BOM's events'
       // subscribers (ADR 0007).
       await this.db.bomComponent.deleteMany({ where: { bomId: where.id } });
       const saved = await this.db.bom.upsert({
         where,
         create: toCreateInput(create, this.clock.now()),
         update: {
           standardBomId: update.standardBomId,
           standardBomMiCode: update.standardBomMiCode,
           brand: update.brand,
           productName: update.productName,
           standardLength: update.standardLength,
           orderNumber: update.orderNumber,
           trackingNumber: update.trackingNumber,
           description: update.description,
           registeredBy: update.registeredBy,
           components: { create: toNestedCreate(update.components) },
         },
         include: COMPOSITION_INCLUDE,
       });
       return toRecord(saved);
   ```

4. Replace `PrismaBomRepository`'s constructor, and add `delegate()`:

   ```ts
     constructor(
       txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
       dispatcher: DomainEventDispatcher,
       private readonly clock: Clock,
     ) {
       super(txHost, dispatcher);
     }

     protected delegate(): ModelDelegate<BomRecord> {
       return new BomDelegate(this.txHost.tx, this.clock);
     }
   ```

5. In `list()`, change `this.prisma.bom.findMany` to `this.txHost.tx.bom.findMany`.
6. Leave `toCreateInput`, `toNestedCreate`, `toRecord` and the kept `standardBom*` field names
   untouched.

In
`backend/src/modules/manufacturing-instructions/infrastructure/persistence/manufacturing-instruction.repository.ts`,
make the same six edits with these names:

- the delegate is `ManufacturingInstructionDelegate`, with fields `db` and `clock`. Its `findUnique`
  and `delete` use `this.db.manufacturingInstruction`.
- `upsert` body, without the `$transaction` wrapper:

  ```ts
      const { where, create, update } = args;
      // `ManufacturingInstruction.edit()` discards the previous composition
      // in full rather than merging with it — this mirrors that literally,
      // deleting the existing `standard_bom_component` rows (cascading to
      // `standard_bom_material`) before recreating the composition the
      // aggregate now holds. Runs on the transaction
      // `PrismaEntityRepository.save()` opened (ADR 0007).
      await this.db.manufacturingInstructionComponent.deleteMany({
        where: { manufacturingInstructionId: where.id },
      });
      const saved = await this.db.manufacturingInstruction.upsert({
        where,
        create: toCreateInput(create, this.clock.now()),
        update: {
          miCode: update.miCode,
          brand: update.brand,
          standardLength: update.standardLength,
          active: update.active,
          description: update.description,
          productId: update.productId,
          productName: update.productName,
          components: { create: toNestedCreate(update.components) },
        },
        include: COMPOSITION_INCLUDE,
      });
      return toRecord(saved);
  ```

  Keep the field list exactly as the file has it after the rename. Only the wrapper and the client
  change.
- `PrismaManufacturingInstructionRepository`'s constructor takes `(txHost, dispatcher, clock)`, as
  above. Its `delegate()` returns
  `new ManufacturingInstructionDelegate(this.txHost.tx, this.clock)`, typed
  `ModelDelegate<ManufacturingInstructionRecord>`.
- `findByMiCode` and `list` use `this.txHost.tx.manufacturingInstruction`.

- [ ] **Step 5: Confirm no write-path `PrismaService` or `$transaction` remains**

```bash
grep -rnF '$transaction' backend/src
grep -rn "this\.prisma\." backend/src/modules/*/infrastructure/persistence/{material,component,product,user,bom,manufacturing-instruction}.repository.ts
grep -rn "EventBus" backend/src/modules/*/infrastructure/persistence
```

Expected: no output from any of the three. The read-side repositories (`*-report`, `*-dashboard`)
are not in that list and keep `this.prisma`.

- [ ] **Step 6: Compile and run the unit suite**

```bash
docker compose -f backend/docker-compose.yml run --rm --no-deps app npx tsc --noEmit -p tsconfig.json
make backend/run-unit-tests
make backend/lint-architecture
```

Expected: all exit 0. The repository specs test only `toCreateInput`, so they are unaffected. If
`tsc` rejects passing `this.txHost.tx` where a delegate expects `Prisma.TransactionClient`, type the
delegates' `db` parameter as `TransactionHost<TransactionalAdapterPrisma<PrismaService>>['tx']`
instead. That is exactly the adapter's transaction-client type. It is not a constructor that Nest
injects, so the type-alias rule in Global Constraints does not apply.

- [ ] **Step 7: Run the integration suite and check the expected half-way state**

```bash
make backend/run-integration-tests
```

Expected: cases 2, 3, 4, 5 and 9 PASS. Rollback now works, because the tripwires are
`@DomainEventHandler`s that the repository awaits inside its transaction. Cases 1, 6, 7 and 8 FAIL:
the audit handlers are still `@EventsHandler`s, which nothing publishes to any more, so no entry is
written and `record()`/`getName()` are never called. Any other pattern means a delegate or repository
conversion is wrong, so fix it before going on.

- [ ] **Step 8: Commit**

```bash
git add -A backend
git commit -m "wip: run repository writes and event dispatch in one transaction"
```

---

### Task 4: Join the audit trail to the transaction

**Files:**
- Modify: `backend/src/modules/audit-logging/application/service/audit-log-projector.service.spec.ts`
- Modify: `backend/src/modules/audit-logging/application/service/audit-log-projector.service.ts`
- Modify: `backend/src/modules/audit-logging/infrastructure/persistence/audit-log.repository.ts`
- Modify: all 18 `backend/src/modules/audit-logging/application/event-handlers/*/*.handler.ts`:
  - `identity/user-{registered,deleted,edited}.handler.ts`
  - `products/{product-registered,product-renamed,product-deleted,component-registered,component-renamed,component-deleted,material-registered,material-edited,material-deleted}.handler.ts`
  - `manufacturing-instructions/manufacturing-instruction-{registered,edited,deleted}.handler.ts`
  - `boms/bom-{registered,edited,deleted}.handler.ts`

**Interfaces:**
- Consumes (Task 1): `DomainEventHandler`, `DomainEventHandlerOf` (`@framework/application`).
  Consumes (Task 3): the transactional `PrismaEntityRepository.save()`/`delete()`.
- Produces: `AuditLogProjector.project(recordType, recordId, action, changes?)`. Its signature is
  unchanged; it now **rejects** on any failure except "no actor". `PrismaAuditLogRepository.record()`
  writes on `txHost.tx`.

- [ ] **Step 1: Turn the two "swallows" projector specs into "propagates" specs**

In `audit-log-projector.service.spec.ts`, replace the test
`'swallows a failure resolving the actor’s display name rather than letting it propagate'` with:

```ts
  it('propagates a failure resolving the actor’s display name, so the change it describes rolls back', async () => {
    const actorId = Identity.new();
    const { sut, auditLogRepository } = makeSut(
      actorId,
      new Map(),
      new Error('user not found'),
    );

    await expect(
      sut.project(AuditRecordType.User, 'user-1', AuditAction.Registered),
    ).rejects.toThrow('user not found');
    expect(auditLogRepository.recorded).toEqual([]);
  });
```

and replace `'swallows a failure writing the entry rather than letting it propagate'` with:

```ts
  it('propagates a failure writing the entry, so the change it describes rolls back', async () => {
    const actorId = Identity.new();
    const auditLogRepository = new InMemoryAuditLogRepository();
    auditLogRepository.record = () => Promise.reject(new Error('db down'));
    const sut = new AuditLogProjector(
      auditLogRepository,
      new StubDisplayNameProvider(new Map([[actorId.asString(), 'Yashar']])),
      new StubActorContext(actorId),
      new FixedClock(),
    );

    await expect(
      sut.project(AuditRecordType.User, 'user-1', AuditAction.Registered),
    ).rejects.toThrow('db down');
  });
```

Keep `'skips projecting, without throwing, when there is no actor in context'` and the two
recording tests exactly as they are.

- [ ] **Step 2: Run them to verify they fail**

```bash
make backend/run-unit-tests
```

Expected: FAIL in exactly the two new tests, with `Received promise resolved instead of rejected`.

- [ ] **Step 3: Remove the projector's `try`/`catch`**

Replace the doc comment and the `project` method in `audit-log-projector.service.ts`. The
constructor, the fields and the imports stay as they are:

```ts
/**
 * The single place every `@DomainEventHandler` in
 * `application/event-handlers/**` delegates to: resolves "who did this" via
 * `ActorContext` + `DisplayNameProvider`, "when" via `Clock`, and writes one
 * `AuditLogEntry` (plus its `changes`) through `AuditLogRepository`.
 *
 * It runs inside the aggregate write's transaction:
 * `PrismaEntityRepository.save()`/`delete()` await
 * `DomainEventDispatcher.dispatch()` within `txHost.withTransaction()`. So
 * any failure here, whether resolving the actor's name or writing the
 * entry, propagates and rolls the change back with it (ADR 0007,
 * src/modules/audit-logging/CLAUDE.md). Do not catch it.
 *
 * The one case still skipped rather than failed is no actor in context: a
 * system action with no human behind it (`DefaultAdminSeeder` at boot or
 * after a test-stack truncate). It is logged, and the change commits
 * without an entry.
 */
@Injectable()
export class AuditLogProjector {
  private readonly logger = new Logger(AuditLogProjector.name);

  constructor(
    private readonly auditLogRepository: AuditLogRepository,
    private readonly displayNameProvider: DisplayNameProvider,
    private readonly actorContext: ActorContext,
    private readonly clock: Clock,
  ) {}

  async project(
    recordType: AuditRecordType,
    recordId: string,
    action: AuditAction,
    changes: AuditChange[] = [],
  ): Promise<void> {
    const actorId = this.actorContext.currentUserId();
    if (actorId === null) {
      this.logger.warn(
        `No actor in context while projecting a ${recordType} ${action} audit entry for ${recordId}; skipping.`,
      );
      return;
    }

    const actorName = await this.displayNameProvider.getName(actorId);

    await this.auditLogRepository.record({
      occurredAt: this.clock.now(),
      actorId: actorId.asString(),
      actorName,
      recordType,
      recordId,
      action,
      changes,
    });
  }
}
```

- [ ] **Step 4: Run the unit suite to verify it passes**

```bash
make backend/run-unit-tests
```

Expected: PASS.

- [ ] **Step 5: Write audit entries on the transaction client**

In `backend/src/modules/audit-logging/infrastructure/persistence/audit-log.repository.ts`:
- add imports `TransactionHost` from `@nestjs-cls/transactional` and `TransactionalAdapterPrisma`
  from `@nestjs-cls/transactional-adapter-prisma`;
- replace the constructor and the first line of `record()`:

```ts
  constructor(
    private readonly prisma: PrismaService,
    private readonly txHost: TransactionHost<
      TransactionalAdapterPrisma<PrismaService>
    >,
  ) {}

  // On `txHost.tx`, not `prisma`: `record()` runs inside the aggregate
  // write's transaction (ADR 0007), so the entry commits or rolls back with
  // the change it describes. The three reads below never run inside a write
  // and stay on `prisma`.
  async record(entry: RecordAuditLogEntryInput): Promise<void> {
    await this.txHost.tx.auditLogEntry.create({
```

The rest of `record()`'s `data` and the other three methods are unchanged.

- [ ] **Step 6: Swap the decorator on all 18 audit handlers**

Create `/tmp/swap-audit-handlers.pl`:

```perl
s{^import \{ EventsHandler, IEventHandler \} from '\@nestjs/cqrs';$}{import { DomainEventHandler, DomainEventHandlerOf } from '\@framework/application';};
s{\@EventsHandler\(}{\@DomainEventHandler(};
s{implements IEventHandler<}{implements DomainEventHandlerOf<};
```

Run it over the handlers (not the specs), then let ESLint re-sort imports and re-wrap lines:

```bash
perl -pi /tmp/swap-audit-handlers.pl backend/src/modules/audit-logging/application/event-handlers/*/*.handler.ts
grep -rln "@nestjs/cqrs" backend/src/modules/audit-logging/application/event-handlers
grep -rh "@DomainEventHandler(" backend/src/modules/audit-logging/application/event-handlers | wc -l
make backend/fix-lint
```

Expected: the first `grep` prints nothing, and the count is `18`.

For reference, `products/material-registered.handler.ts` before:

```ts
import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { AuditSnapshot } from '@audit-logging/application/service/audit-snapshot';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { MaterialRegistered } from '@products/domain/events/material-registered.event';

@EventsHandler(MaterialRegistered)
export class MaterialRegisteredAuditHandler implements IEventHandler<MaterialRegistered> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: MaterialRegistered): Promise<void> {
    await this.projector.project(
      AuditRecordType.Material,
      event.materialId,
      AuditAction.Registered,
      AuditSnapshot.of({ name: event.name, code: event.code }).asRegistration(),
    );
  }
}
```

and after (only the import, the decorator and the `implements` clause change; the body is
identical):

```ts
import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { AuditSnapshot } from '@audit-logging/application/service/audit-snapshot';
import {
  DomainEventHandler,
  DomainEventHandlerOf,
} from '@framework/application';
import { MaterialRegistered } from '@products/domain/events/material-registered.event';

@DomainEventHandler(MaterialRegistered)
export class MaterialRegisteredAuditHandler
  implements DomainEventHandlerOf<MaterialRegistered>
{
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: MaterialRegistered): Promise<void> {
    await this.projector.project(
      AuditRecordType.Material,
      event.materialId,
      AuditAction.Registered,
      AuditSnapshot.of({ name: event.name, code: event.code }).asRegistration(),
    );
  }
}
```

The handler specs construct handlers with `new` and call `handle()`, so they need no change.

- [ ] **Step 7: Confirm `EventBus` is gone from the backend**

```bash
grep -rn "EventBus\|EventsHandler\|IEventHandler\|IEvent\b" backend/src --include=*.ts
```

Expected: matches only in comments, namely `framework/domain/service/post-truncate-hook.ts`,
`identity/infrastructure/bootstrap/default-admin-seeder.ts` and the `CqrsModule` comment in
`app.module.ts`. All three explain why `EventBus` is **not** used. No `import` line may match.

- [ ] **Step 8: Run everything backend, integration last**

```bash
docker compose -f backend/docker-compose.yml run --rm --no-deps app npx tsc --noEmit -p tsconfig.json
make backend/run-unit-tests
make backend/lint-architecture
make backend/lint
make backend/format
make backend/lint-swagger
make backend/run-integration-tests
```

Expected: everything exits 0, and the integration run shows **9 passed**. `lint-swagger` must pass
with no regeneration: no route, DTO or decorator that feeds the spec changed.

- [ ] **Step 9: Commit**

```bash
git add -A backend
git commit -m "wip: project audit entries inside the write transaction"
```

---

### Task 5: Update the backend documentation

**Files:**
- Modify: `backend/CLAUDE.md`
- Modify: `backend/src/framework/CLAUDE.md`
- Modify: `backend/src/modules/audit-logging/CLAUDE.md`
- Modify: `backend/src/modules/products/CLAUDE.md`

**Interfaces:**
- Consumes: the names from Tasks 1–4.
- Produces: nothing in code.

- [ ] **Step 1: `backend/CLAUDE.md`**

1. In the first Commands block, directly after the `make run-unit-tests` line, add:

   ```bash
   make run-integration-tests  # Jest integration tests (test/integration/), against the test stack's Postgres
   ```

2. Under *Framework Abstractions*:
   - In the `AggregateRoot` bullet, replace "repository base class calls `releaseEvents()` and
     publishes via EventBus on save." with "the repository base class calls `releaseEvents()` on
     save/delete and awaits `DomainEventDispatcher.dispatch()` with them, inside the write's
     transaction."
   - Replace the `PrismaEntityRepository` bullet with:

     ```markdown
     - **`PrismaEntityRepository<Domain, Prisma>`** — concrete Prisma base; subclasses implement `delegate()` (built from `this.txHost.tx` on every call), `toDomain()` and `toPersistence()`. `save()` is an upsert keyed on `id`; `save()` and `delete()` each write and dispatch the aggregate's events in one transaction — see *Writes, transactions and domain events* below.
     - **`DomainEventDispatcher`** / **`@DomainEventHandler(EventClass)`** (`framework/application`) — the port that delivers domain events, and the decorator that subscribes a provider (implementing `DomainEventHandlerOf<E>`) to one event class. `DomainEventsModule` (global) binds it to `DiscoveredDomainEventDispatcher`.
     - **`PrismaTransactionsModule`** — registers `nestjs-cls` with the `@nestjs-cls/transactional` Prisma adapter, so `TransactionHost<TransactionalAdapterPrisma<PrismaService>>` is injectable everywhere.
     ```

3. Replace the *Request Flow* code block with:

   ```
   Controller → CommandBus → CommandHandler → Aggregate.factory() → Repository.save()
                                                                         ↓
                                             txHost.withTransaction(
                                               upsert on txHost.tx
                                               → DomainEventDispatcher.dispatch(events)
                                               → each @DomainEventHandler, awaited in turn )
   ```

4. Directly after the Request Flow block, add this section:

   ```markdown
   ### Writes, transactions and domain events

   Every write runs in one Postgres transaction that also covers the reactions to it (ADR 0007).
   `PrismaTransactionsModule` (`framework/infrastructure/persistence/`, imported by `AppModule`)
   makes `TransactionHost<TransactionalAdapterPrisma<PrismaService>>` injectable everywhere:

   - `txHost.withTransaction(fn)` opens a Prisma interactive transaction, or joins the one already
     open (default propagation `Required`). It creates its own CLS context when there is none, which
     is why `DefaultAdminSeeder` can save at boot with no request.
   - `txHost.tx` is the transaction client inside one, and the plain `PrismaService` outside.

   `PrismaEntityRepository.save()`/`delete()` write the aggregate on `txHost.tx`, then await
   `DomainEventDispatcher.dispatch(entity.releaseEvents())` in the same `withTransaction`. The
   dispatcher runs each event's `@DomainEventHandler` providers one at a time, in order, and lets
   the first error propagate. That error rolls back the aggregate's write too. So:

   - **Every Prisma access on the write path goes through `txHost.tx`**, never `PrismaService`. That
     covers a repository's `delegate()` and finders, the hand-written delegates (which open no
     `$transaction` of their own), `PrismaAuditLogRepository.record()`, and `PrismaUserRepository`
     (the audit actor-name lookup). A query on `PrismaService` inside a transaction takes another
     connection and cannot see the transaction's uncommitted rows.
   - **A handler awaits all its work** and never runs queries concurrently on `txHost.tx`.
   - **Read-side repositories** (reports, exports, filters, dashboard, audit-log search) stay on
     `PrismaService`, since they never run inside a write.
   - `@nestjs/cqrs` is used for `CommandBus` and `QueryBus` only. Nothing injects `EventBus`, and a
     domain event is never published outside the repository's transaction (ADR 0007's review rule).
   - A command that saves several aggregates can wrap itself in one `txHost.withTransaction()` and
     they share one transaction, with no change to the repositories.
   ```

5. Under *Testing*, directly after the **Unit tests** paragraph and the paragraph that follows it,
   add:

   ```markdown
   **Integration tests** — Jest, in `test/integration/**/*.int-spec.ts`, configured by
   `jest.integration.config.ts`, which reuses `package.json`'s `jest` block for the aliases and the
   transform. Run them with `make run-integration-tests`. It starts the **test** stack (`test-up`),
   applies its migrations (`npm run db:migrate`), then runs `npm run test:integration` in that
   stack's app container, against its Postgres. The cases build a Nest testing module from the real
   modules (no HTTP), set the actor through the real `ActorContextMiddleware`, and prove what a unit
   test cannot: an aggregate's rows and its audit entry commit or roll back together. Each case uses
   fresh ids and unique names and deletes its own rows in `afterEach`. Nothing truncates. The unit
   suite never picks these files up: they are outside `src/`, and `.int-spec.ts` does not match
   `.spec.ts`.
   ```

- [ ] **Step 2: `backend/src/framework/CLAUDE.md`**

1. Under *Application Layer*, after the `EmailSender` section, add:

   ```markdown
   ### `DomainEventDispatcher` (`application/domain-event-dispatcher.ts`) and `@DomainEventHandler` (`application/domain-event-handler.decorator.ts`)
   The port that delivers an aggregate's released domain events, and the decorator that subscribes
   a provider to one event class: `@DomainEventHandler(MaterialRegistered)` on a class implementing
   `DomainEventHandlerOf<MaterialRegistered>` (`handle(event): Promise<void>`). The decorator also
   applies `@Injectable()`; the class must still be listed in its module's `providers`. `dispatch()`
   takes events in order and awaits each one's handlers one at a time, in registration order. An
   event with no handler is a no-op, and the first error propagates. This replaces
   `@nestjs/cqrs`' `EventBus` for domain events (ADR 0007).
   ```

2. Under *Infrastructure Layer*, in the `PrismaEntityRepository` section:
   - Replace "Concrete Prisma implementation. Subclasses must implement:" and its two bullets with:

     ```markdown
     Concrete Prisma implementation. Subclasses must implement:
     - `delegate(): ModelDelegate<PModel>` — this aggregate's delegate, built from `this.txHost.tx` on
       **every** call (`return this.txHost.tx.material;`, or a hand-written delegate constructed with
       `this.txHost.tx`). Never cache it.
     - `toDomain(record: PModel): T` — maps a Prisma record to the domain aggregate.
     - `toPersistence(entity: T): PModel` — maps the aggregate back to a Prisma record.
     ```

   - Replace the paragraph that ends "publishes all events via `EventBus.publishAll()`." and the
     "Constructor takes `(delegate: ModelDelegate, eventBus: EventBus)`" paragraph with:

     ```markdown
     `save()` is an **upsert** keyed on `id`, so it covers both creating and updating an aggregate —
     there is no separate `add`. It runs inside `txHost.withTransaction()`: the upsert, then
     `await dispatcher.dispatch(entity.releaseEvents())`, so a failing subscriber (the audit
     projection) rolls the upsert back. Nested calls join the outer transaction.

     Constructor takes
     `(txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>, dispatcher: DomainEventDispatcher)`.
     A subclass repeats both parameters, written out in full (a type alias breaks Nest's DI metadata),
     and passes them to `super`. Every other query it makes uses `this.txHost.tx.<model>`.
     `ModelDelegate<PModel>` is a narrow structural type requiring `findUnique`, `upsert` and
     `delete`, which is what keeps the base class from depending on generated Prisma types.
     ```

   - In the `delete(entity: T)` paragraph, replace "publishes the entity's released events, the same
     way `save()` does" with "dispatches the entity's released events in the same transaction, the
     same way `save()` does".

3. Directly after the `PrismaService` section, add:

   ```markdown
   ### `PrismaTransactionsModule` (`infrastructure/persistence/prisma-transactions.module.ts`)
   Registers `nestjs-cls` globally (`middleware: { mount: true }`) with `ClsPluginTransactional` and
   `TransactionalAdapterPrisma({ prismaInjectionToken: PrismaService })`. `txHost.tx` is the
   transaction client inside `withTransaction()` and `PrismaService` outside it. `AppModule` and the
   backend integration suite both import this one module, so the suite tests exactly this
   configuration.

   ### `DomainEventsModule` / `DiscoveredDomainEventDispatcher` (`infrastructure/events/`)
   Global; binds `DomainEventDispatcher`. On module init the dispatcher uses Nest's
   `DiscoveryService` and `Reflector` to map each event class to its `@DomainEventHandler`
   singletons. A provider also bound with `useExisting` is not registered twice.
   ```

- [ ] **Step 3: `backend/src/modules/audit-logging/CLAUDE.md`**

1. In *The one legitimate cross-module dependency*, replace "one `@EventsHandler` class per
   subscribed domain event" with "one `@DomainEventHandler` class per subscribed domain event".
2. In *Resolving "who did this"*, replace the sentence that begins
   "`AuditLogProjector` reads `ActorContext.currentUserId()` at projection time" and ends
   "right after the command's own database write." with:

   ```markdown
   `AuditLogProjector` reads `ActorContext.currentUserId()` at projection time — later in the same
   request, inside the command's own write transaction: `PrismaEntityRepository.save()`/`delete()`
   await `DomainEventDispatcher.dispatch()` within `txHost.withTransaction()`, so the projection runs
   in the request's own async context chain.
   ```

3. Delete the final paragraph of that section, the one beginning "If there is no actor in context
   (shouldn't happen behind a guarded mutating endpoint, but defensive), or *anything* fails" and
   ending "can't even become an unhandled rejection." Insert this section in its place, before
   *The list query's day-boundary `to` filter*:

   ```markdown
   ## The transactional contract: no change without its entry, no entry without its change

   An audit entry is written **in the same Postgres transaction** as the change it describes
   (ADR 0007). `PrismaEntityRepository.save()`/`delete()` open the transaction with
   `TransactionHost.withTransaction()` (`@nestjs-cls/transactional`), write the aggregate on
   `txHost.tx`, then await `DomainEventDispatcher.dispatch()` on the aggregate's released events.
   Every handler here is a `@DomainEventHandler`, so `AuditLogProjector.project()` runs inside that
   transaction. `PrismaAuditLogRepository.record()` and the actor-name lookup (through
   `PrismaUserRepository`) both run on the same `txHost.tx`.

   So a failure anywhere in the projection is the command's failure. If resolving the actor's
   display name throws (for example, the actor was deleted mid-request), or writing
   `audit_log_entry`/`audit_log_entry_change` throws, then the error propagates and the
   transaction rolls back, the aggregate's rows included. The client gets a 500 Problem Details
   (`ProblemDetail.forUnknownError()`). The projector has no `try`/`catch`; don't add one back. We
   prefer "the change didn't happen" to "the change happened without a record".

   The one case still skipped rather than failed is **no actor in context**. These are system
   actions with no human behind them: `DefaultAdminSeeder` at boot, and after the test stack's
   truncate. The projector logs a warning and returns, and the change commits without an entry.

   Handlers run one at a time on one transaction client, so a handler must **await** all its work
   and never run queries concurrently (`Promise.all`) on `txHost.tx`. The read side (`search`,
   `filterOptions`, `findChangesByEntryId`) stays on `PrismaService`, since it never runs inside a
   write.

   `make run-integration-tests` proves this against a real Postgres
   (`backend/test/integration/transactional-audit-trail.int-spec.ts`). A throwing subscriber, a
   failing `record()` or an unknown actor leaves no aggregate row behind, and a committed change
   has exactly one entry.
   ```

- [ ] **Step 4: `backend/src/modules/products/CLAUDE.md`**

At the end of the paragraph that begins "`PrismaProductRepository` cannot pass `prisma.product`
directly as its `ModelDelegate`", replace `prisma.product` with `tx.product`, and append:

```markdown
That delete-and-recreate opens no transaction of its own: the delegate is built per call from
`txHost.tx`, so it runs inside the transaction `PrismaEntityRepository.save()` opened, and commits
or rolls back together with the product's event subscribers (ADR 0007).
```

- [ ] **Step 5: Verify and commit**

```bash
grep -rn "EventBus.publish\|eventBus: EventBus\|@EventsHandler\|logs and returns rather than throwing" backend/CLAUDE.md backend/src/framework/CLAUDE.md backend/src/modules/*/CLAUDE.md
```

Expected: no output.

```bash
git add -A backend
git commit -m "wip: document the transactional write path"
```

---

### Task 6: Root gate, CI job and root docs (orchestrator)

The orchestrator does this task itself: these are root files.

**Files:**
- Modify: `Makefile`
- Modify: `.github/workflows/ci.yml`
- Modify: `CLAUDE.md`
- Modify: `docs/adrs/0005-synchronous-in-process-communication.md`,
  `docs/adrs/0006-govern-architecture-with-fitness-functions.md`,
  `docs/adrs/0007-transactional-audit-trail.md`, `docs/adrs/README.md`

**Interfaces:**
- Consumes (Task 2): `make -C backend run-integration-tests`.
- Produces: root `make run-integration-tests`, CI job `integration-tests`, and the tenth
  `run-guardrails` step.

- [ ] **Step 1: Root `Makefile`**

Add `run-integration-tests` to `.PHONY`, after `run-unit-tests`. Add this target directly after
`run-unit-tests`:

```make
# Backend-only, like lint-architecture. Unlike the other backend checks it needs a database, so it
# starts the backend test stack — the same one run-acceptance-tests drives — and migrates it.
run-integration-tests: ## Run the backend integration tests against the test stack's database
	@$(MAKE) -C backend run-integration-tests
```

In `run-guardrails`, insert `@$(MAKE) run-integration-tests` directly after
`@$(MAKE) run-unit-tests`.

Check it:

```bash
make help | grep run-integration-tests
make -n run-guardrails | grep -n "run-unit-tests\|run-integration-tests\|lint-accessibility"
```

Expected: the help line is listed, and the dry run shows the order unit → integration →
accessibility.

- [ ] **Step 2: `.github/workflows/ci.yml`**

Directly after the `unit-tests` job, add:

```yaml
  integration-tests:
    name: Run integration tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - run: make run-integration-tests
```

- [ ] **Step 3: Root `CLAUDE.md`**

1. *Definition of done*: "CI's nine checks" → "CI's ten checks".
2. *Commands*: directly after the `make run-unit-tests` line, add:

   ```bash
   make run-integration-tests  # backend Jest integration tests against the backend test stack's Postgres
   ```

3. *Continuous integration*:
   - Replace "Nine jobs run in parallel, one per check:" and the target list after it with:

     ```markdown
     Ten jobs run in parallel, one per check:
     `make format`, `make lint`, `make lint-styles`, `make lint-architecture`, `make lint-swagger`,
     `make lint-api-contract`, `make lint-accessibility`, `make run-unit-tests`,
     `make run-integration-tests`, `make run-acceptance-tests`.
     ```

   - "the local mirror of these nine jobs" → "the local mirror of these ten jobs".
   - Replace the order block with:

     ```
     lint-api-contract → format → lint-styles → lint → lint-architecture → lint-swagger
                       → run-unit-tests → run-integration-tests → lint-accessibility
                       → run-acceptance-tests
     ```

   - Replace "`lint-api-contract` goes first because it is a bare `cmp` with no container, and the
     two that need something running go last. It is a convenience, not a gate: CI keeps its nine
     parallel jobs," with:

     ```markdown
     `lint-api-contract` goes first because it is a bare `cmp` with no container, and the three that
     need something running go last. It is a convenience, not a gate: CI keeps its ten parallel jobs,
     ```

   - Directly after that paragraph (the one ending "container running."), add:

     ```markdown
     `run-integration-tests` is the second check that needs the backend **test** stack running, after
     `run-acceptance-tests`, and the cheapest of the three that need anything running. It brings that
     stack up (`test-up`), applies its migrations with `prisma migrate deploy`, and runs the backend's
     Jest integration suite inside the stack's app container, against its Postgres. That suite is
     the auditability fitness function: it proves an aggregate's change and its audit entry commit or
     roll back together (ADR 0007). Each case cleans up its own rows, and nothing truncates, so it can
     run before the acceptance suite against the same database.
     ```

4. *Continuous deployment*: "cleared all nine CI checks" → "cleared all ten CI checks".

Leave "any of the eight marked as required" alone: it describes branch protection, not the job
count.

- [ ] **Step 4: ADRs**

`docs/adrs/0005-synchronous-in-process-communication.md`, append to `## Notes`:

```markdown
- Since [0007](0007-transactional-audit-trail.md) was implemented, domain events no longer go
  through `@nestjs/cqrs`' `EventBus`. `PrismaEntityRepository` hands them to
  `DomainEventDispatcher` (`framework/application`), an awaited, sequential, in-process dispatcher
  that runs inside the aggregate write's transaction. Subscribers are marked
  `@DomainEventHandler(EventClass)`. `CommandBus` and `QueryBus` are unchanged.
```

`docs/adrs/0006-govern-architecture-with-fitness-functions.md`:
- Add this table row directly after the *Testability* row:

  ```markdown
  | Auditability | `make run-integration-tests` (atomic change + audit entry) |
  ```

- In *Consequences*, "runs nine jobs" → "runs ten jobs".
- In *Compliance*, "lists all nine" → "lists all ten".
- Delete the gap bullet "**Auditability has no fitness function yet.** See
  [0007](0007-transactional-audit-trail.md)."

`docs/adrs/0007-transactional-audit-trail.md`, append to `## Notes`:

```markdown
- Implemented on 2026-10-15
  (`docs/superpowers/specs/2026-10-15-transactional-audit-trail-design.md`). The ambient
  transaction comes from `nestjs-cls` with `@nestjs-cls/transactional` and its Prisma adapter, and
  events go through an awaited `DomainEventDispatcher` in `framework/`. `make
  run-integration-tests` is the Compliance section's unit-level fitness function, run against a
  real Postgres.
- Correction to Context point 3: `$transaction` *was* used, by three hand-written delegates
  (product, standard BOM, BOM), each for its own delete-and-recreate of child rows. They now run on
  the repository's transaction instead. The line numbers in points 1 and 2 describe the code before
  this change.
```

`docs/adrs/README.md`: replace "ADRs 0007 and 0009 were accepted on 2026-10-15 and are not yet
implemented." with "ADRs 0007 and 0009 were accepted on 2026-10-15 and have since been implemented."

- [ ] **Step 5: Leave the root changes unstaged for Task 7**

Do not commit. Task 7 commits them as the second of the two final commits.

```bash
git status --short Makefile .github CLAUDE.md docs/adrs
```

Expected: these 7 files are modified: `Makefile`, `ci.yml`, `CLAUDE.md` and 4 ADR files.

---

### Task 7: Prove it, run the guardrails, write the two commits (orchestrator)

**Files:** none new.

**Interfaces:**
- Consumes: Tasks 1–5 committed as `wip:` commits, and Task 6 uncommitted. The squash base is the commit
  recorded in `/tmp/audit-trail.base` by Task 1 Step 1.
- Produces: the two final commits.

- [ ] **Step 1: The contract, the schema and the other projects are unchanged**

```bash
make generate-swagger
sha256sum -c /tmp/openapi.before.sha256
git status --short backend/docs frontend/api
git diff --stat "$(cat /tmp/audit-trail.base)" -- backend/prisma frontend acceptance-tests
```

Expected: both `OK`, then `git status` prints nothing, then the diff prints nothing. If
`/tmp/openapi.before.sha256` no longer exists, check
`git diff "$(cat /tmp/audit-trail.base)" -- backend/docs`
instead. It must also be empty.

- [ ] **Step 2: Nothing publishes outside the transaction**

```bash
grep -rnE "^import .*(EventBus|EventsHandler|IEventHandler)" backend/src
grep -rnF '$transaction' backend/src
grep -rn "@DomainEventHandler(" backend/src --include=*.ts | grep -v "\.spec\.ts" | wc -l
```

Expected: no output, no output, then `18`.

- [ ] **Step 3: Run the full guardrails on fresh containers**

```bash
make down
setsid nohup make run-guardrails > /tmp/guardrails-audit.log 2>&1 &
```

The guardrails run detached because the acceptance suite outlives a session restart. Monitor
`/tmp/guardrails-audit.log` until the run finishes.

Expected: exit 0 with all **ten** checks green, in the order of Task 6 Step 1. That includes:
- `run-integration-tests`, with 9 passed;
- `run-acceptance-tests`, unchanged, since the acceptance suite must pass with no change under
  `acceptance-tests/`.

If any check fails, run `make fix-violations` for the automatable ones, fix the rest in the task
that owns the file, and re-run. Do not continue on a red run.

- [ ] **Step 4: Squash into the two final commits**

```bash
git reset --soft "$(cat /tmp/audit-trail.base)"
git reset
git add backend
git commit -m "refactor(backend): write audit entries in the same transaction as the change

Repositories now write an aggregate and deliver its released domain
events in one Postgres transaction (ADR 0007). nestjs-cls with the
@nestjs-cls/transactional Prisma adapter provides the ambient
transaction; every write-path Prisma access, the three hand-written
delegates (which drop their own \$transaction), the audit record() and
the actor-name lookup run on txHost.tx. A DomainEventDispatcher port in
framework/, with a DiscoveryService-backed implementation, awaits
@DomainEventHandler subscribers in order and replaces @nestjs/cqrs'
EventBus for domain events. The audit projector no longer swallows
errors, so a failed projection fails the command and rolls the change
back; no-actor system actions still skip. A new integration suite
(make run-integration-tests) proves the atomicity against the test
stack's Postgres.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git add Makefile .github/workflows/ci.yml CLAUDE.md docs/adrs
git commit -m "ci: add the backend integration-test gate

Adds the root run-integration-tests target, its CI job and its
run-guardrails step (ten checks now), documents it in CLAUDE.md, and
records ADR 0007 as implemented: auditability gets its fitness function
in ADR 0006, ADR 0005 notes that domain events left EventBus, and ADR
0007's context is corrected on \$transaction.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git status --short
git log --oneline -3
```

Expected: `git status` prints nothing, and the log shows the base commit from `/tmp/audit-trail.base` followed by exactly the two
new commits. If `git status` still lists a file, it belongs to neither commit's scope: stop and
report it rather than adding it to either commit.
