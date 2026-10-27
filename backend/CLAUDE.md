# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Skills.** The authority on this stack's design and anti-patterns is the `handbook:architecture-guideline`, `handbook:oop-guideline`, and `handbook:test-guideline` skills — invoke the ones that fit before writing code.

**Where things are documented.** This file covers the project as a whole. `src/framework/CLAUDE.md`
is the home of every framework abstraction's detail (the testing endpoints, the exception pipeline,
`Clock`, the ports), and each module has its own `src/modules/<module>/CLAUDE.md` — see
[Modules](#modules). The repo-root `CLAUDE.md` covers the stacks, ports and code-quality targets
across every project; only what is backend-specific is repeated here.

## Commands

The app runs in Docker; the Makefile wraps Docker Compose. Prerequisites: Docker, Docker Compose, `make`.

```bash
make up                  # build (if needed) and start both stacks, waiting until every container is healthy
make down                # stop and remove both stacks' containers
make restart             # down, then up
make build               # rebuild the image — dev stack only, unlike up/down/reset
make reset               # stop both stacks and wipe both database volumes
make logs                # tail logs from the dev stack
make sh                  # open a shell in the dev stack's app container
make ps                  # status of every container in both stacks
make npm <script>        # run any package.json script inside the dev stack's app container
make run-unit-tests      # Jest unit tests (src/**/*.spec.ts), in a one-off container
make run-integration-tests  # Jest integration tests (test/integration/), against the test stack's Postgres
make help                # list all available make targets
```

Jest is configured inline in `package.json` (`rootDir: src`, `testRegex: .*\.spec\.ts$`) — there is
no `jest.config.js` to look for.

### Two stacks

`up`, `down` and `reset` act on **both** Compose projects: dev (`cablan-backend`, `.env`) and test
(`cablan-backend-test`, `docker-compose.yml` + `docker-compose.test.yml`, `.env.test`,
`NODE_ENV=test`, `LOG_LEVEL=silent`). `docker-compose.test.yml` only renames the project and swaps
the env file: the test stack is the same image with different values, and separate ports and
volumes are what make the two independent. Ports are in the root `CLAUDE.md`.

```bash
make test-up             # build (if needed) and start just the test stack, waiting until healthy
make test-down           # stop and remove just the test stack
make test-reset          # stop the test stack and wipe its database volume
make test-setup          # create .env.test from .env.test.example (make setup already does this)
```

**Why the split.** `TestingModule` — which exposes an endpoint that truncates every table — mounts only
when `NODE_ENV === 'test'`. So an external test runner needs a stack running at that value, and the
split guarantees the endpoint is unreachable on the dev stack while a run in progress can never touch
dev data. The same condition turns rate limiting off (see [Production image](#production-image)).

`make run-unit-tests` and every code-quality target use `docker compose run --rm --no-deps`: a
throwaway container with no database and no published ports, so they need nothing up and are safe
while `make up`'s stack owns the ports. The writing ones still land their changes in the working
tree, since the repo is bind-mounted.

`make up` passes `--wait`, so it returns only once every container is healthy — `db` via
`pg_isready`, `app` via the `GET /api/health` liveness probe.

### Code-quality checks

The targets (`lint`, `fix-lint`, `format`, `fix-format`, `lint-architecture`, `lint-swagger`,
`generate-swagger`) are listed in the root `CLAUDE.md`. Backend-specific facts about them:

- **ESLint embeds Prettier** (`eslint-plugin-prettier/recommended`, `prettier/prettier` as an
  error), so `make lint` fails on formatting alone and `make fix-lint` reformats as it goes;
  `format`/`fix-format` are a cheap re-check of the same files. Prettier here covers only
  `src/**/*.ts` — Markdown is not formatted by anything. `simple-import-sort` is an error too, and
  reordering imports is one way to resurface the barrel crash `no-own-package-barrel` prevents.
- **The rules switched off in `eslint.config.mjs` are decisions, not oversights**; don't "clean
  them up". Most carry their reasoning in a comment (`injectable-should-be-provided` is off because
  of the barrel-spread DI convention, for instance); `no-explicit-any` and `sonarjs/todo-tag` carry
  none. All but one sit in the final rules block and apply everywhere;
  `sonarjs/no-hardcoded-passwords` is off only in its own `**/*.spec.ts` block, so production code
  is still covered.
- **`tsconfig.json` is looser than you may assume**: `noImplicitAny` and `strictBindCallApply` are
  off, only `strictNullChecks` is on, and `no-explicit-any` is disabled to match. Code written
  against a strict-TS assumption will not be caught by the compiler.
- **Prefer the targets over `make npm <script>`.** Because `lint` and `format` are real targets,
  `make npm lint` runs the linter twice (once through the passthrough, once as a second goal). The
  package.json scripts keep their own names (`format:fix`, `depcruise`);
  `.dependency-cruiser.cjs`'s header comment still says `make npm depcruise`, which is wrong for
  that reason — use `make lint-architecture`.

**The OpenAPI spec.** `docs/openapi.json`/`.yaml` are committed and drift the moment a controller,
DTO or `@Api*` decorator changes. `make lint-swagger` rebuilds the document in memory and compares;
`make generate-swagger` rewrites it. Both boot the app (`app.init()`, never `listen()`) but never
query the database — the Prisma driver adapter connects lazily, and `DefaultAdminSeeder` is invoked
only from `main.ts` for exactly this reason. Two more things: the spec is generated **without**
`NODE_ENV=test`, so the testing endpoints are absent from it despite their `@ApiTags`; and
`nest-cli.json` enables the `@nestjs/swagger` CLI plugin (`classValidatorShim`,
`introspectComments`), which injects DTO types and doc comments at **compile** time — that is why
both scripts go through `nest build` and cannot run under ts-node.

A copy of the spec is kept elsewhere in the monorepo and a root-level check compares the two. After
changing a controller or DTO, run `make fix-violations` from the repo root rather than
`make generate-swagger` here, or that check fails on a file this project does not own.

### Other scripts

```bash
make npm start:dev           # (already running via `make up`) hot reload on port 3000
make npm test:cov            # Jest with coverage
make npm db:migrate          # apply Prisma migrations to the dev stack (manual step after `make up`)
make npm db:generate-client  # regenerate Prisma client
```

`make npm` is `docker compose exec` against the **dev** stack, so `db:migrate` migrates
`cablan-backend` only (the root's `make migrate` is the same thing). The test stack migrates through
`POST /api/testing/migrations`, or `make run-integration-tests` migrates it first.

Run a single Jest test file from a shell inside the container (`make sh`): `npx jest path/to/file.spec.ts`.

## Production image

`Dockerfile.prod` is a separate, multi-stage image from the dev-only `Dockerfile` — never built by
`make up`/`make build`, only by the targets below. It compiles at build time (`nest build`) and
installs only production dependencies in the final stage, so devDependencies never ship. There is
deliberately no `db` service alongside it: production Postgres is externally managed, which is also
why CORS is out of scope — the frontend reaches this API through a same-origin reverse proxy.

```bash
make build-prod   # build the image from Dockerfile.prod
make prod-up      # build, then run it locally (forwards DATABASE_URL and JWT_SECRET from the shell)
make prod-down    # stop the locally running container
```

`make prod-up` forwards only `DATABASE_URL` and `JWT_SECRET`, but `DefaultAdminSeeder` reads
`DEFAULT_ADMIN_USERNAME`/`DEFAULT_ADMIN_PASSWORD` with `getOrThrow` right after `listen()`, so a
container started that way exits once it boots. Pass those two with `-e` by hand until the target
forwards them.

Its `ENTRYPOINT`, `docker-entrypoint.prod.sh`, runs `prisma migrate deploy` before
`exec node dist/src/main` — a production deploy is self-migrating, unlike the dev stack. That is why
`prisma` (the CLI) is a real `dependency`: it must be present in the pruned runtime image.

Two dependencies exist for hardening: `helmet`, applied in `configureApp()`, and
`@nestjs/throttler`. `app.module.ts` registers `ThrottlerModule.forRoot([{ ttl: 60_000, limit: 1000 }])`
and a global `ThrottlerGuard` as `APP_GUARD` — **except at `NODE_ENV=test`, where the guard is not
registered at all**, so no throttle applies on the test stack. `AuthController.login` overrides the
default with `@Throttle({ default: { limit: 5, ttl: 60_000 } })`, being the one unauthenticated,
brute-forceable endpoint, and `TestingController` is `@SkipThrottle()` besides.

## Environment

Neither `.env` nor `.env.test` is committed. `make setup` creates **both** from the committed
`.env.example`/`.env.test.example` (`make up` runs it), so the root Makefile can call a plain
`setup` per project without knowing the backend has a second env file. Neither copy overwrites an
existing file. The examples hold working local defaults, which is why CI runs with no secrets.

| Variable | Notes |
|---|---|
| `NODE_ENV` | `development` / `test` / `production`. Gates `TestingModule`, the `TunableClock` and the absence of `ThrottlerGuard` (`=== 'test'`), and Swagger UI + pretty logs (`!== 'production'`). |
| `POSTGRES_USER` / `_PASSWORD` / `_DB` / `_PORT` | Compose builds `DATABASE_URL` from these — don't set it directly. |
| `JWT_SECRET` | Read via `ConfigService.getOrThrow` in `AuthModule`; boot fails without it. |
| `DEFAULT_ADMIN_USERNAME` / `DEFAULT_ADMIN_PASSWORD` | The System Admin `DefaultAdminSeeder` ensures exists, read via `getOrThrow` — a missing one crashes the process after `listen()`. See `src/modules/identity/CLAUDE.md`. |
| `APP_PORT` | **Not in `.env.example`.** Defaults to 3000 via `${APP_PORT:-3000}` in Compose; `.env.test` sets 3001. |
| `STUDIO_PORT` | **Not in `.env.example`.** Prisma Studio; defaults to 5555 the same way, test stack 5556. |
| `LOG_LEVEL` | **Not in `.env.example`.** Overrides the pino level, defaulted in `app.module.ts`. The test stack sets `silent`. |

The bottom three are settable but only `.env.test.example` declares them; their defaults live in
`docker-compose.yml` and `app.module.ts`.

## Editor / host node_modules

The app needs no host `node_modules`, but an editor does, and it is **separate** from the
container's: `docker-compose.yml` bind-mounts `./:/app` while an anonymous volume
(`- /app/node_modules`) shadows it, so the container keeps the `node_modules` its image built and
never sees the host copy.

After the container's dependencies or the Prisma schema change, sync the host with **`npm ci`**
(needs Node 24 locally; it also runs `prisma generate` via `postinstall`), then restart the editor's
TS server. **Never `npm install` for this sync**: it rewrites `package-lock.json`, and a host npm
that differs from the container's churns it (e.g. `"peer": true` metadata) for no real change. Make
real dependency changes inside the container (`make sh` → `npm install`) and commit them.

The container side of the same split — refreshing a stale in-container `node_modules`/Prisma client
after a schema change — is a rebuild with `--renew-anon-volumes`, unrelated to this.

**The code-quality targets use the image's Prisma client, too.** `make lint`, `make lint-swagger`,
`make generate-swagger` and `make run-unit-tests` run in a throwaway container whose
`node_modules` (generated client included) comes from the image, built when the schema last was.
After a schema change they fail on the new fields — typed ESLint rules report "error typed value",
`nest build` fails — until `make build` rebuilds the image. CI is unaffected (it always cold-builds).
The same happens when the shared `cablan-backend-app` image is merely **stale** — built by another
checkout before a schema change that is already on your branch: `make lint` and
`make generate-swagger` then fail with type errors in files you never touched (e.g. `reviewedBy`
"does not exist" in `bom-report.repository.ts`). That is the image, not your change; `make backend/build`
fixes it.
The image tag is shared by every checkout of this repo on the machine, so a git worktree with a
different schema can build its own instead: `COMPOSE_PROJECT_NAME=<name> make backend/<target>`
(that variable overrides the compose file's `name:`, giving a separate image, stack and volume).

## Architecture

This project implements **DDD + CQRS** as a modular monolith with a strict layered structure. Every
module follows the same vertical-slice pattern.

### Modules

| Module | Owns | Doc |
|---|---|---|
| `identity` | Users, login, JWT issuance; binds the framework's user-facing ports | `src/modules/identity/CLAUDE.md` |
| `products` | Materials, components, products and product composition | `src/modules/products/CLAUDE.md` |
| `manufacturing-instructions` | Standard BOMs ("آنالیز استاندارد"), still named so on the wire | `src/modules/manufacturing-instructions/CLAUDE.md` |
| `boms` | Daily BOMs: capture, review (approve / reject), reporting, export, dashboard | `src/modules/boms/CLAUDE.md` |
| `audit-logging` | The system-wide audit trail — a read-side projector, no aggregate | `src/modules/audit-logging/CLAUDE.md` |

The module structure is ADR 0009 and data ownership is ADR 0004 (repo-root `docs/adrs/`). How
modules meet:

- **Dependencies point one way: `boms` → `manufacturing-instructions` → `products`.** Each arrow
  is a `QueryBus` query dispatched from one named file, allowed by a narrow dependency-cruiser
  carve-out that pins exactly which query and read-model files it may import (see
  [Architecture linting](#architecture-linting)). Nothing calls another module's repository.
- **Data crosses as a snapshot, not a reference** (ADR 0004): an aggregate copies the names and
  fields it needs at write time (a standard BOM's `productName`, a daily BOM's MI code, brand and
  composition names), so a later rename never rewrites history. There are no cross-module foreign
  keys.
- **`identity` and `audit-logging` are reached through ports in `framework/`**, never by import:
  `UserRoleProvider`, `DisplayNameProvider`, `PostTruncateHook` (bound by `identity`) and
  `ActorContext`. `audit-logging` may import other modules' `domain/events/*.ts` and nothing else.

### Layer Layout (per module)

```
src/modules/<module>/
├── domain/               # Pure business logic — no framework imports
│   ├── <name>.aggregate.ts
│   ├── events/           # Domain events (implement DomainEvent), plus their snapshot types
│   ├── value/            # Value objects (<name>.vo.ts)
│   └── service/          # Port interfaces (write-side Repository, external services)
├── application/
│   ├── commands/         # ICommandHandler implementations, one directory each
│   │   └── index.ts      # Barrel — the module spreads it into `providers`
│   ├── queries/          # IQueryHandler + ReadModel DTOs
│   │   └── index.ts
│   ├── event-handlers/   # @DomainEventHandler subscribers (audit-logging only, so far)
│   ├── service/          # Application services (composition factories) and read-model repository ports
│   ├── support/          # In-memory repositories and stubs for unit specs — not wired into any module
│   └── exceptions/       # ApplicationException subclasses
│       └── index.ts
└── infrastructure/
    ├── <module>.module.ts       # The NestJS module for the whole slice
    ├── <adapter>.ts             # Port implementations live loose here
    │                            #   (bcrypt-password-hasher.ts, jwt-token.service.ts)
    ├── bootstrap/               # Boot-time work (identity's DefaultAdminSeeder)
    ├── spreadsheet/             # Export grid builders (rows from a read model)
    ├── http/
    │   ├── controllers/
    │   │   ├── index.ts         # Barrel — spread into `controllers`
    │   │   └── <name>/          # One directory per controller
    │   │       ├── <name>.controller.ts
    │   │       └── dto/         # Input DTOs (class-validator decorators)
    │   └── exception.mapper.ts  # Domain → Problem Detail mapping
    └── persistence/
        ├── <name>.repository.ts  # Extends PrismaEntityRepository (or a read-side Prisma repository)
        └── <name>.mapper.ts      # Domain ↔ Prisma model conversion
```

Not every module has every directory. The barrels are load-bearing: a module spreads
`Controllers`, `CommandHandlers` and `QueryHandlers` rather than listing each one, which is also
why `injectable-should-be-provided` is off. DTOs nest **under their controller**, not in a shared
`http/dto/`. A read-model repository port lives in `application/service/`, not `domain/service/`
(`handbook:oop-guideline`'s "Read Models and Layers").

### Framework Abstractions (`src/framework/`)

Each is documented in `src/framework/CLAUDE.md`; this is the index.

- **`AggregateRoot`** / **`Entity`** / **`ValueObject`** / **`Identity`** / **`Email`** — the domain building blocks. Value objects validate in a static factory and throw a plain `Error`, which surfaces as a 500 if it is reachable from untrusted input.
- **`EntityRepository<T>`** / **`PrismaEntityRepository<Domain, Prisma>`** — `find`, `get`, `save` (an upsert); an opt-in `delete`. `save()`/`delete()` write and dispatch the aggregate's events in one transaction.
- **`DomainEventDispatcher`** / **`@DomainEventHandler(EventClass)`** — in-transaction domain-event delivery (ADR 0007).
- **`PrismaTransactionsModule`** / **`PrismaService`** / **`PrismaModule`** — the connection and the `TransactionHost`.
- **`Clock`** — **never call `new Date()` in a handler or an aggregate**; inject `Clock`. A `TunableClock` replaces it at `NODE_ENV=test`.
- **`Role`**, **`@Roles(...)`**, **`RolesGuard`**, **`UserRoleProvider`** — role-based access; the role is looked up per request, never read from the token.
- **`ActorContext`** / **`ActorContextMiddleware`** / **`ActorContextModule`** — "who is making this request", for application code (the audit projector).
- **`DisplayNameProvider`** — a user's display name from an id, for cloning "who did this".
- **`PostTruncateHook`** — work awaited after the test stack's truncate.
- **`AuthModule`** / **`JwtAuthGuard`** / **`@CurrentUser()`** — JWT verification against the injected `Clock`.
- **`ProblemDetail`** / **`HttpExceptionFilter`** / **`ExceptionMapper`** — the RFC 9457 error pipeline; see [Exception Handling](#exception-handling).
- **`EmailSender`** / **`InMemoryEmailOutbox`**, **`HealthModule`**, **`TestingModule`**, the spreadsheet helpers and the Swagger error schemas.

`src/configure-app.ts` is the single wiring point for the global prefix, `helmet`, the validation
pipe, the exception filter and Swagger. `main.ts` and the swagger generator both call it, which is
how the generated spec is guaranteed to describe the app that actually boots.

### Request Flow

```
Controller → CommandBus → CommandHandler → Aggregate.factory() → Repository.save()
                                                                      ↓
                                          txHost.withTransaction(
                                            upsert on txHost.tx
                                            → DomainEventDispatcher.dispatch(events)
                                            → each @DomainEventHandler, awaited in turn )
```

### Writes, transactions and domain events

Every write runs in one Postgres transaction that also covers the reactions to it (ADR 0007).
`PrismaTransactionsModule` makes `TransactionHost<TransactionalAdapterPrisma<PrismaService>>`
injectable everywhere. `txHost.withTransaction(fn)` opens a Prisma interactive transaction or joins
the open one, creating its own CLS context when there is none (which is why `DefaultAdminSeeder` can
save with no request); `txHost.tx` is the transaction client inside one and the plain
`PrismaService` outside.

`PrismaEntityRepository.save()`/`delete()` write on `txHost.tx`, then await
`DomainEventDispatcher.dispatch(entity.releaseEvents())` in the same transaction. Handlers run one
at a time and the first error propagates, rolling the aggregate's write back too. So:

- **Every Prisma access on the write path goes through `txHost.tx`**, never `PrismaService` —
  repository delegates and finders, hand-written delegates (which open no `$transaction` of their
  own), `PrismaAuditLogRepository.record()`, and `PrismaUserRepository` (the audit actor-name
  lookup). A query on `PrismaService` inside a transaction takes another connection and cannot see
  the transaction's uncommitted rows.
- **A handler awaits all its work** and never runs queries concurrently on `txHost.tx`.
- **Read-side repositories** (reports, exports, filters, dashboard, audit-log search) stay on
  `PrismaService`, since they never run inside a write.
- `@nestjs/cqrs` is used for `CommandBus` and `QueryBus` only. Nothing injects `EventBus`, and a
  domain event is never published outside the repository's transaction (ADR 0007's review rule).
- A command that saves several aggregates can wrap itself in one `txHost.withTransaction()`.

### Exception Handling

All error responses are **RFC 9457 Problem Details** (`application/problem+json`):
`HttpExceptionFilter` walks a list of `ExceptionMapper`s and the first whose `canMap()` matches
wins; nothing matching is a 500. The filter, the mapper list and the problem-type URIs are
detailed in `src/framework/CLAUDE.md`.

To add a new domain exception:
1. Create the class extending `ApplicationException` in `application/exceptions/`.
2. Add a case to the module's `ExceptionMapper` in `infrastructure/http/exception.mapper.ts`.
3. **If the module's mapper is itself new, register it** in the `ExceptionMappers` array at the top
   of `src/framework/infrastructure/http/exception.filter.ts` — a hardcoded `const`, not DI.

Skipping step 3 fails quietly: nothing throws, the mapper never matches, and the response is a
generic **500** instead of the status you intended.

**Validation errors are the other half.** `configure-app.ts` installs a `ValidationPipe` with
`whitelist`, `forbidNonWhitelisted`, `forbidUnknownValues` and `transform`, plus an
`exceptionFactory` that reshapes class-validator's output into `{ field, message }[]`;
`FrameworkExceptionMapper` unpacks exactly that into a 400 `validation-error` problem with an
`errors` array. So an **unknown property in a request body is a 400**, and changing that factory's
shape breaks the mapper that reads it.

### Architecture linting

Layer and module boundaries are enforced by **dependency-cruiser** (`.dependency-cruiser.cjs`,
`make lint-architecture`). The rules:

- **Layering** — no cycles (`no-circular`); `domain` imports no `application`/`infrastructure` and
  no NestJS/Prisma; `application` never reaches into `infrastructure`.
- **`framework-independent-of-modules`** — `framework` names no feature module, with one
  exception: `exception.filter.ts`, which composes the module mappers.
- **`no-own-package-barrel`** — a file under `src/framework/{domain,application,infrastructure}/`
  must not import its own `index.ts`; it crashes at runtime, not build time (see
  `src/framework/CLAUDE.md`).
- **`modules-isolated`** — a module imports nothing from another, except from four files/directories
  it exempts, each then bounded by its own `*-reuse-is-narrow` rule:
  `ManufacturingInstructionCompositionFactory` → `GetProductQuery` (+ `ProductReadModel`);
  `BomCompositionFactory` → `GetManufacturingInstructionByMiCodeQuery` (+ its read model);
  `StandardBomWeights` (boms) → `GetManufacturingInstructionDetailQuery` (+ its read model);
  `audit-logging/application/event-handlers/**` → the other modules' `domain/events/*.ts`.

A new cross-module dependency means a new carve-out pair, not a widened one. Mechanics worth knowing
when a rule fires unexpectedly: `no-circular` ignores cycles routed through an `index.ts`;
`tsPreCompilationDeps` is on, so an `import type` still counts; `*.spec.ts` files are excluded from
the graph. The rules see only TypeScript imports — a Prisma query on another module's table is
invisible to them (see `src/modules/boms/CLAUDE.md`'s dashboard section for the one that exists).

### Testing

**Unit tests** — Jest, co-located `*.spec.ts` next to the code they test, across `src/framework/`
and every module. Handlers are tested against the in-memory fakes in each module's
`application/support/`. Run via `make run-unit-tests`.

**Integration tests** — Jest, `test/integration/**/*.int-spec.ts`, configured by
`jest.integration.config.ts` (which reuses `package.json`'s `jest` block for the aliases and
transform, and runs files one at a time). `make run-integration-tests` starts the test stack,
applies its migrations, then runs `npm run test:integration` in that stack's app container. The
cases build a Nest testing module from the real modules (no HTTP), set the actor through the real
`ActorContextMiddleware`, and prove what a unit test cannot:

- `transactional-audit-trail.int-spec.ts` — an aggregate's rows and its audit entry commit or roll
  back together (ADR 0007's fitness function).
- `bom-approval.int-spec.ts` — the daily-BOM review: approval and rejection with their audit
  entries (tracking-number subject, the rejection's reason as management note), a reviewer's edit
  noted on an approval made in a later request (the `pending_review_changes` JSON column's round
  trip) and an inspector's edit not noted, an edit of a reviewed BOM listing as `Edited` then a
  newer `ReturnedToPending` (the `sequence` tie-breaker), rollback when the audit entry fails, and
  the report's reviewer filter (`''` = pending, a name = that reviewer's approvals and rejections).
- `bom-dashboard-filters.int-spec.ts` — the dashboard's approval filters: a product's count and
  newest registration over its matching daily BOMs only, and `''`/`[]` on both reads; and its
  `orderNumber`/`trackingNumber` searches as Postgres reads them — a trimmed, case-insensitive
  substring on both reads, the two ANDed, a blank one unfiltered.
- `bom-resampling.int-spec.ts` — "the latest daily BOM of its tracking number", the fact
  re-sampling turns on, on the write repository and the report rows/detail alike: daily BOMs
  registered at one (pinned) instant still ordered by `registration_sequence`, other tracking
  numbers ignored, a BOM the latest again once the later one's tracking number is edited away or it
  is deleted.
- `material-code-uniqueness.int-spec.ts` — the database backstop for material codes.
- `persian-digit-normalisation.int-spec.ts` — the `normalise_persian_digits` data migration: it
  seeds rows with Persian/Arabic-Indic digits, re-runs the migration's SQL (one idempotent `DO`
  block) and checks what was rewritten, what was left because it would collide on a unique column,
  and that the audit log is untouched.

Each case uses fresh ids and unique names and deletes its own rows in `afterEach`; nothing
truncates. The unit suite never picks these up (outside `src/`, and `.int-spec.ts` does not match
`.spec.ts`).

**Testing-support endpoints** (`TestingModule`) let an external test runner migrate and truncate the
database, drive the clock, and read the email outbox; they exist only when `NODE_ENV === 'test'`.
Truncate is a full clean slate: every table, the outbox, and then the awaited `PostTruncateHook` —
which `identity` binds to `DefaultAdminSeeder`, so the default admin is re-seeded after every
truncate. The endpoint list is in `src/framework/CLAUDE.md`.

### Prisma

Prisma 7, with a **multi-file schema** — there is no `prisma/schema.prisma`:

```
prisma/
├── schema/
│   ├── _config.prisma      # generator + datasource
│   └── <module>.prisma     # one file per module, mirroring src/modules/
└── migrations/
```

`prisma.config.ts` points the CLI at the directory (`schema: 'prisma/schema'`). A model goes in its
owning module's file. The `datasource` block has no `url`: it comes from `prisma.config.ts` for CLI
work and from the `PrismaPg` driver adapter at runtime, both reading `DATABASE_URL`.

Migrations are generated (`db:migration:create`), and the repo's hooks deny hand-edits under
`prisma/migrations/`. Prisma's DSL cannot express everything, though: `app_user`'s partial unique
index on `username` was hand-added to its migration when that migration was created, and is what
actually enforces username uniqueness.

**Read a generated draft before keeping it.** Prisma cannot tell a renamed column from a dropped
one plus a new one: `bom.approved_by` → `reviewed_by` came out of `prisma migrate dev
--create-only` as a `DROP COLUMN` + `ADD COLUMN`, which would have silently discarded every stored
value. That migration (`20261025082638_daily_bom_review`) was amended at creation to a
`RENAME COLUMN` plus the data rewrite it needed. Amend a draft only before it is applied anywhere;
the guard hook blocks the Write/Edit tools on `migration.sql` regardless, so such an amendment
goes through the shell, deliberately.

Two conventions in the schema itself: every field carries an explicit `@map` to a snake_case
column and every model an `@@map` to a snake_case table — `User` is `app_user`, since `user` is
awkward in Postgres. And annotate every `DateTime` with `@db.Timestamptz(N)`; the Prisma default is
`timestamp without time zone`, which stores bare UTC that then reads back as a wrong local time.

### Path Aliases

`@framework/*` → `src/framework/*`, and one per module: `@identity/*`, `@products/*`,
`@manufacturing-instructions/*`, `@boms/*`, `@audit-logging/*` → `src/modules/<module>/*`. A new
module adds its alias in both `tsconfig.json`'s `paths` and `package.json`'s Jest
`moduleNameMapper`.

### Logging

Structured JSON logging via `nestjs-pino`. The `authorization` and `cookie` headers, `set-cookie`,
and `password`/`confirmPassword` body fields are redacted. Pretty-printed outside production.

### API Conventions

- All routes are prefixed with `/api`.
- `GET /api/health` — public liveness probe, mounted in every environment; touches no dependencies,
  so it stays `200` even when the database is down.
- Auth is a Bearer JWT carrying only `sub`; `@CurrentUser()` extracts it.
- Swagger UI is at `/api-docs` outside production.
