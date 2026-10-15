# Design: write audit entries in the same transaction as the change

- **Date:** 2026-10-15
- **Implements:** [ADR 0007](../../adrs/0007-transactional-audit-trail.md). This is the third of
  three refactorings. It comes after
  [the manufacturing-instructions rename](2026-10-15-standard-boms-to-manufacturing-instructions-design.md)
  and [the products merge](2026-10-15-merge-materials-components-into-products-design.md).
- **Kind:** backend persistence and event-dispatch change, plus one new CI gate.
- **Precondition:** both earlier refactorings have landed. Module names assume `products` and
  `manufacturing-instructions`.

## Goal

Every committed change to an aggregate has its audit entry, and every audit entry belongs to a
committed change. Both rows are written in one Postgres transaction. A failure in either rolls
back both.

## Current state

Facts this design depends on:

- **Repositories.** `PrismaEntityRepository.save()` and `delete()`
  (`framework/infrastructure/persistence/prisma.repository.ts`) await the write, then call
  `eventBus.publishAll(...)` without awaiting it. All six aggregate repositories extend this
  class.
- **Hand-written delegates.** The product, manufacturing-instruction and BOM repositories use
  hand-written delegates. Each of these opens its own `prisma.$transaction` to delete and recreate
  child rows. ADR 0007's claim that "nothing uses `$transaction`" is wrong on this point.
- **Event dispatch.** `@nestjs/cqrs` 11 `EventBus` pushes events into an RxJS stream. Handlers
  cannot be awaited, and their failures go to `UnhandledExceptionBus`.
- **The audit handlers.** The only domain-event subscribers are the 18 `@EventsHandler` classes in
  `audit-logging`. Each one calls `AuditLogProjector.project(...)`.
- **The projector.** `AuditLogProjector.project` does three things:
  1. it skips, with a warning, when `ActorContext` has no user;
  2. it resolves the actor's name through `DisplayNameProvider`, which runs a `prisma.user` query;
  3. it writes through `PrismaAuditLogRepository.record`, a single nested `create`.

  It wraps all of this in a `try/catch` that logs any error and swallows it.
- **Writes per command.** Every command handler saves or deletes exactly one aggregate.

## 1. One ambient transaction

**Packages.** We adopt the established `nestjs-cls` (^7), `@nestjs-cls/transactional` (^4) and
`@nestjs-cls/transactional-adapter-prisma` (^2), which declares support for Prisma `>4 <9`. They
go in `backend/package.json` through npm inside the container, so the lockfile stays
authoritative. We use a package rather than hand-rolling an AsyncLocalStorage transaction, as
`CLAUDE.md` asks.

**Wiring.** `ClsModule.forRoot` is registered globally in `AppModule`:

- `middleware: { mount: true }`
- `plugins: [new ClsPluginTransactional({ imports: [PrismaModule], adapter: new TransactionalAdapterPrisma({ prismaInjectionToken: PrismaService }) })]`

**Write path.**

- `PrismaEntityRepository` depends on `TransactionHost<TransactionalAdapterPrisma<PrismaService>>`
  and the new `DomainEventDispatcher`, and no longer on `EventBus`.
- `save(entity)` becomes:

  ```ts
  await this.txHost.withTransaction(async () => {
    await this.writeUpsert(entity);   // via this.txHost.tx
    await this.dispatcher.dispatch(entity.releaseEvents());
  });
  ```

  `delete(entity)` follows the same pattern.
- Nested `withTransaction` calls join the outer transaction (the default propagation, `Required`).
  A future command that saves two aggregates can therefore wrap itself in one transaction without
  further changes.

**What moves onto `txHost.tx`.** Every Prisma access on the write path:

- the six repositories' `find`/`get`/`findByName`/`list` and their writes;
- the three hand-written delegates. They drop their own `$transaction` and run their
  `deleteMany` + `upsert` on `txHost.tx`, inside the repository's transaction.
- `PrismaAuditLogRepository.record`;
- `PrismaUserRepository`, so `IdentityDisplayNameProvider`'s lookup reads in the same
  transaction.

Outside a transaction, `txHost.tx` falls back to the plain client, so reads behave exactly as
before.

**What stays on `PrismaService`.** Read-side repositories: the BOM and MI report, export, filter
and dashboard repositories, and audit-log search, filter options and changes. They never write.

## 2. Awaited domain-event dispatch, owned by `framework/`

- **Port.** `framework/application/domain-event-dispatcher.ts`:

  ```ts
  export abstract class DomainEventDispatcher {
    abstract dispatch(events: readonly object[]): Promise<void>;
  }
  ```

- **Decorator.** `framework/application/domain-event-handler.decorator.ts`:
  `@DomainEventHandler(EventClass)` marks a provider whose `handle(event): Promise<void>` must run
  for that event class. Handlers implement `DomainEventHandlerOf<E>` with
  `handle(event: E): Promise<void>`.
- **Implementation.** `framework/infrastructure/events/discovered-domain-event-dispatcher.ts`:
  - On module init, it builds a map from event constructor to handler instances, using Nest's
    `DiscoveryService` and `Reflector`.
  - `dispatch` takes events in order and, for each one, awaits its handlers in registration order,
    one at a time. Nothing runs in parallel, so a single transaction client is never used
    concurrently.
  - An event with no handler is a no-op.
  - The first error propagates.
- **Registration.** `framework/infrastructure/events/domain-events.module.ts` (global) imports
  `DiscoveryModule` and binds the port.
- **Audit handlers.** All 18 replace `@EventsHandler(X)` / `IEventHandler<X>` with
  `@DomainEventHandler(X)` / `DomainEventHandlerOf<X>`. Their bodies do not change.
- **What's left of `@nestjs/cqrs`.** `CqrsModule` stays for `CommandBus` and `QueryBus`.
  `EventBus` is no longer injected anywhere.
- **Layering.** The dependency-cruiser layer rules allow this: the decorator and port are in
  `framework/application`, and nothing in `domain/` imports them.

## 3. Failure behaviour

| Situation | Before | After |
|---|---|---|
| Audit `record` fails | Logged and swallowed; the change is committed | Error propagates; transaction rolls back; the client gets a 500 Problem Details (`ProblemDetail.forUnknownError`); the change is **not** saved |
| `DisplayNameProvider.getName` fails (e.g. actor deleted mid-request) | Logged and swallowed | Same as above |
| No actor in `ActorContext` (default-admin seeding at boot, the test truncate hook) | Warning, entry skipped, change committed | **Unchanged**. These are system actions with no human actor |
| The aggregate write fails | Error, nothing written, no event | Unchanged |

The projector loses its `try/catch`. The no-actor early return stays.

## 4. Proof: a backend integration gate

- **Location.** `backend/test/integration/`, run by a separate Jest config
  (`backend/jest.integration.config.ts`, matching `*.int-spec.ts`). It runs in the backend
  **test** stack's app container, against that stack's Postgres, after migrations.
- **Isolation.** Each case uses fresh UUIDs and unique names, and deletes its own rows in
  `afterEach`. Nothing truncates the database. CI runs it in its own job; locally,
  `run-guardrails` runs it sequentially.
- **The cases:**
  1. **Commit.** Saving a new `Material` with an actor in context leaves the `material` row and
     exactly one `audit_log_entry` for it, with `recordType 'Material'`.
  2. **Save rolls back.** A test-only `@DomainEventHandler(MaterialRegistered)` that throws makes
     `save` reject, and leaves **no** `material` row and no audit entry for it.
  3. **Delete rolls back.** On `delete` of an existing material, the same throwing handler for
     `MaterialDeleted` leaves the row in place.
  4. **Nested write rolls back.** Editing an existing product's composition with a throwing
     handler for `ProductComponentsUpdated` leaves the **original** `product_component` and
     `product_material` rows intact.
  5. **No actor.** Saving with no actor commits the row and writes no audit entry.
- **Bootstrapping.** The cases build a Nest testing module from the real modules
  (`PrismaModule`, `ClsModule`, `DomainEventsModule`, `ProductsModule`, `AuditLoggingModule`, …)
  and override only what a case needs. The throwing handler is registered as an extra provider.
  The actor is set by running the case inside the existing `ActorContext` mechanism, which the
  plan pins down.
- **Targets and CI:**
  - `backend/Makefile`: `run-integration-tests: test-up`, which runs
    `npm run test:integration` in the test stack's app container.
  - Root `Makefile`: `run-integration-tests` (`## ` documented) delegating to it.
  - `.github/workflows/ci.yml`: a tenth job that calls the root target.
  - `run-guardrails`: the new step goes after `run-unit-tests`.
- **Unit tests:**
  - A new `discovered-domain-event-dispatcher.spec.ts` covers four things: events go to the
    handlers registered for their class, handlers run sequentially in event order, an unhandled
    event is a no-op, and the first error propagates while later handlers do not run.
  - `audit-log-projector.service.spec.ts`: the two "swallows a failure" cases become "propagates
    the failure". "Skips when there is no actor" is kept.
  - The repository specs keep testing only their pure helpers.

## 5. Docs

- `backend/src/modules/audit-logging/CLAUDE.md`: replace the reasoning for swallowing errors
  with the transactional contract.
- `backend/CLAUDE.md`: in the persistence section, explain that writes go through `txHost.tx`
  and events through `DomainEventDispatcher`. Add the integration suite and its target.
- ADR 0005: a Notes line saying domain events now go through an awaited in-process dispatcher
  inside the write transaction, and `@nestjs/cqrs`' `EventBus` is no longer used for them.
- ADR 0006: a table row "Auditability | `make run-integration-tests` (atomic change + audit
  entry)", and remove the "auditability has no fitness function" gap.
- ADR 0007: a Notes line correcting the two wrong claims in its context (`$transaction` *is*
  used, by three delegates; the projector's `catch` is at line 62), and saying it is implemented.
- Root `CLAUDE.md`: "nine checks" → ten. Add the new target to the command list, the CI job list
  and the `run-guardrails` order, with a sentence explaining that it is the second check that
  needs a running stack.
- `docs/adrs/README.md`: the 0007/0009 line says they are implemented.

## 6. Delivery

1. **Backend commit**, by a `backend-engineer` dispatch:
   `refactor(backend): write audit entries in the same transaction as the change`. It contains
   the packages, the framework port and dispatcher, the repository and delegate changes, the
   handler decorator swap, the projector change, the integration suite, the
   `backend/Makefile` target, and the backend docs.
2. **Root commit**, by the orchestrator: `ci: add the backend integration-test gate`. It contains
   the root `Makefile` target and `run-guardrails` line, the CI job, the root `CLAUDE.md`, and the
   ADR notes.
3. The orchestrator runs `make run-guardrails`, now ten checks, to green before either commit is
   reported done.

## Unchanged

- Routes, DTOs, OpenAPI. `make generate-swagger` produces no diff.
- Tables. No migration.
- Domain events and their payloads.
- Audit `recordType` values and change keys.
- The frontend and the acceptance tests.
- Behaviour when the audit write succeeds, which is the normal case. The acceptance suite,
  including `viewing-audit-log.feature`, must pass unchanged.

## Out of scope

- Moving `ActorContext` onto CLS.
- Transactions around whole commands.
- An outbox or asynchronous subscribers.
- Read-side repositories.
