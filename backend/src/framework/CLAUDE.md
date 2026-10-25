# Framework (`src/framework/`)

Reusable base classes and ports for DDD + CQRS. Import via path aliases:

- `@framework/domain` — `Entity`, `AggregateRoot`, `ValueObject`, `Identity`, `Email`, `DomainEvent`,
  `EntityRepository`, `DomainException`/`EntityNotFound`, `Role`, `toAsciiDigits`, and the ports
  `Clock`, `ActorContext`, `UserRoleProvider`, `DisplayNameProvider`, `PostTruncateHook`
- `@framework/application` — `ApplicationException`, `DomainEventDispatcher`, `@DomainEventHandler`
  (+ `DomainEventHandlerOf`), `EmailSender`/`EmailMessage`
- `@framework/infrastructure` — the global modules, the Prisma repository base, the HTTP pipeline
  (filter, mappers, guards, `@Roles`, `@CurrentUser`, `ActorContextMiddleware`), clock and email
  implementations, `TestingModule`, Swagger helpers, and the spreadsheet helpers

One rule the architecture lint enforces here and nowhere else: **a file under
`domain/`, `application/` or `infrastructure/` must not import its own package's `index.ts`.**
Import the sibling module by path. Going through your own barrel creates a load-order cycle that
survives the type-checker and crashes at runtime — `FrameworkExceptionMapper` is the case that
taught us, and `no-own-package-barrel` in `.dependency-cruiser.cjs` is what now catches it.

## Ports here, bindings in a module

Several ports are abstract classes in `@framework/domain` whose only binding is supplied by a
feature module, because only that module knows how: `UserRoleProvider`, `DisplayNameProvider` and
`PostTruncateHook` are all bound by `identity` (`src/modules/identity/CLAUDE.md`). Framework
consumers (`RolesGuard`, `TestingService`) and other modules (`boms`' controller, `audit-logging`'s
projector) inject the port and never import `identity`. Two consequences:

- **The binding module must be `@Global()` and export the port**, or the consumer's constructor
  fails to resolve at boot. `IdentityModule` is global for exactly this reason.
- **Bind with `useExisting` when the concrete class is also used directly** — the same trick as
  `ClockModule` and `EmailModule` — so both tokens resolve to one singleton.

`Clock`, `ActorContext` and `EmailSender` follow the same shape but are bound in framework itself.

---

## Domain Layer

### `ValueObject`
Base for all value objects. Equality is structural (deep JSON comparison of all properties).

The convention every value object follows: **a private constructor and a static factory
that validates**, so an instance cannot exist in an invalid state. `Email.fromString` normalises
then validates; `Identity.fromString` validates non-empty.

Note what they throw on invalid input: a plain `Error`, not a `DomainException`. No
`ExceptionMapper` matches a plain `Error`, so it falls through to `ProblemDetail.forUnknownError()`
and the client sees a **500, not a 400**. Value objects built from already-validated DTO input are
fine; one built straight from untrusted request data needs DTO validation in front of it or a
mapped exception instead.

### `Entity`
Base for domain entities. Equality is identity-based (compares `id` only).
Constructor requires an `Identity`.

### `AggregateRoot` extends `Entity`
- `recordThat(event: DomainEvent)` — appends to the internal event queue.
- `releaseEvents(): DomainEvent[]` — returns all queued events and clears the queue.

Call `recordThat` inside business methods (factory or mutation); the repository base calls `releaseEvents` on save and delete and dispatches them in the write's transaction.

### `DomainEvent`
Marker interface — implement it on any event class. No required fields.

### `Identity`
Core identifier value object wrapping a UUID string.
- `Identity.new()` — generates a new UUID.
- `Identity.fromString(id)` — creates from an existing string (validates non-empty only, so a
  non-UUID string such as an MI code is accepted — `EntityNotFound.withId` relies on that).
- `.asString()` / `.toString()` — returns the raw value.

### `Email`
- `Email.fromString(email)` — trims whitespace, lowercases, validates format; throws on invalid.
- `.asString()` / `.toString()` — returns the normalised email.

### `toAsciiDigits` (`domain/ascii-digits.ts`)
A pure function: every Persian (U+06F0–06F9) and Arabic-Indic (U+0660–0669) digit — what a
Persian keyboard types — becomes its English digit; every other character is left alone. It is
how «۱۲۳۴» and «1234» are one value (issue #62). The rule lives in the domain, not the client:
each module applies it in the `fromString` of the value objects that hold typed identifiers and
names (`OrderNumber`, `TrackingNumber`, `MiCode`, `Brand`, `MaterialCode`, `MaterialName`,
`ProductName`, `ComponentName`, `Username`) and in `Bom.register()`/`edit()` for the description,
so create, edit, uniqueness checks and lookups all see the normalised value. A new field of that
kind should apply it the same way. Rows stored before it were rewritten once by the
`normalise_persian_digits` migration — see the module docs for the rows it left alone.

### `EntityRepository<T extends AggregateRoot>` (abstract)
| Method | Behaviour |
|--------|-----------|
| `find(id: Identity)` | Returns `T \| null` |
| `get(id: Identity)` | Returns `T` or throws `EntityNotFound` |
| `save(entity: T)` | Persists and dispatches domain events, in one transaction |

### `Role` (`domain/role.ts`)
The four roles: `SystemAdmin` (`system_admin`), `Management`, `QcInspector`, `Reporter`. It lives
here, not in `identity`, so every module can name a role in `@Roles()` without importing another
module. Stored as a plain string column; ADR 0009 plans to replace the fixed enum with dynamic
permissions.

### `Clock` (`domain/service/clock.ts`)
The port for "what time is it": `abstract class Clock { abstract now(): Date }`.

**Never call `new Date()` in an aggregate, a handler or a service.** Inject `Clock` and call
`now()`. Time is a dependency like any other, and this is what lets a test pin it.

Implementations live in `infrastructure/clock/` and are wired by `ClockModule`, which is `@Global()`
and chooses on `NODE_ENV === 'test'`:

| | `SystemClock` | `TunableClock` |
|---|---|---|
| Bound when | every other environment | `NODE_ENV=test` |
| `now()` | the real time | a held instant, frozen until moved |
| Starts at | — | `DEFAULT_INSTANT` (`2026-01-01T00:00:00.000Z`) |

In test the module binds `TunableClock` as a provider and `Clock` with `useExisting`, so consumers
inject `Clock` while the testing endpoints inject the concrete `TunableClock` to call `set`,
`advanceBy` and `reset` on the same singleton. A `TunableClock` never advances on its own.

### `ActorContext` (`domain/service/actor-context.ts`)
"Who is making this request": `currentUserId(): Identity | null`. `null` whenever there is no
request in flight, no bearer token, or an undecodable one — callers must handle it. Bound to
`ActorContextMiddleware` (below). Its only reader today is `audit-logging`'s projector.

### `UserRoleProvider` / `DisplayNameProvider` / `PostTruncateHook` (`domain/service/`)
- `UserRoleProvider.getRole(userId): Promise<Role | null>` — the user's **current** role; `null`
  for an unknown or deleted user. Consumed by `RolesGuard`.
- `DisplayNameProvider.getName(userId): Promise<string>` — the user's current display name, for a
  module that clones "who did this" onto its own record (`boms`' `registeredBy`/`reviewedBy`, the
  audit entry's `actorName`).
- `PostTruncateHook.run(): Promise<void>` — awaited by `TestingService.truncateAll()` after the
  tables are wiped. It is a port rather than an `EventBus` event because `@nestjs/cqrs`' publisher
  is fire-and-forget: a re-seed dispatched through it could still be running after the 204, and
  the next request would race it.

All three are bound by `identity` — see [Ports here, bindings in a module](#ports-here-bindings-in-a-module).

### `DomainException`
Abstract base for domain-layer exceptions — an empty `extends Error`, so it imposes no message or
type contract of its own. Extend for invariant violations.

### `EntityNotFound`
Extends `DomainException`.
- `EntityNotFound.withId(id: Identity)` — static factory. It stores the value as `identifier`, but
  `FrameworkExceptionMapper` emits it under the extension member key **`entityId`**; that is the
  name a client sees on the wire.

---

## Application Layer

### `ApplicationException`
Abstract base for use-case exceptions (not domain invariants) — like `DomainException`, an empty
`extends Error`. Extend for business-rule failures surfaced at the application layer (e.g. a
duplicate username, invalid credentials).

### `EmailSender` / `EmailMessage` (`application/service/email-sender.ts`)
The port for "deliver this message", and the message itself (`recipient: Email`, `subject`, `body`).
Nothing here names a transport. See `InMemoryEmailOutbox` below for the only binding.

### `DomainEventDispatcher` (`application/domain-event-dispatcher.ts`) and `@DomainEventHandler` (`application/domain-event-handler.decorator.ts`)
The port that delivers an aggregate's released domain events, and the decorator that subscribes
a provider to one event class: `@DomainEventHandler(MaterialRegistered)` on a class implementing
`DomainEventHandlerOf<MaterialRegistered>` (`handle(event): Promise<void>`). The decorator also
applies `@Injectable()`; the class must still be listed in its module's `providers`. `dispatch()`
takes events in order and awaits each one's handlers one at a time, in registration order. An
event with no handler is a no-op, and the first error propagates. This replaces
`@nestjs/cqrs`' `EventBus` for domain events (ADR 0007).

---

## Infrastructure Layer

### `PrismaEntityRepository<T, PModel>` extends `EntityRepository<T>`
Concrete Prisma implementation. Subclasses must implement:
- `delegate(): ModelDelegate<PModel>` — this aggregate's delegate, built from `this.txHost.tx` on
  **every** call (`return this.txHost.tx.material;`, or a hand-written delegate constructed with
  `this.txHost.tx`). Never cache it.
- `toDomain(record: PModel): T` — maps a Prisma record to the domain aggregate.
- `toPersistence(entity: T): PModel` — maps the aggregate back to a Prisma record.

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

`delete(entity: T)` hard-deletes the row and dispatches the entity's released events in the same
transaction — but it is **not** part of the abstract `EntityRepository` base. A module opts in by
declaring `delete` on its own repository port; every aggregate but `User` (soft-deleted through the
ordinary `save()`) does.

### `PrismaService`
Extends `PrismaClient`. Provided globally by `PrismaModule` — never instantiate directly.

### `PrismaTransactionsModule` (`infrastructure/persistence/prisma-transactions.module.ts`)
Registers `nestjs-cls` globally (`middleware: { mount: true }`) with `ClsPluginTransactional` and
`TransactionalAdapterPrisma({ prismaInjectionToken: PrismaService })`. `txHost.tx` is the
transaction client inside `withTransaction()` and `PrismaService` outside it. `AppModule` and the
backend integration suite both import this one module, so the suite tests exactly this
configuration.

### `DomainEventsModule` / `DiscoveredDomainEventDispatcher` (`infrastructure/events/`)
Global; binds `DomainEventDispatcher`. On module init the dispatcher uses Nest's
`DiscoveryService` and `Reflector` to map each event class to its `@DomainEventHandler`
singletons. A provider also bound with `useExisting` is not registered twice. A
`@DomainEventHandler` that is not a static singleton (request-scoped, transient, or depending on
such a provider) makes module init throw, naming the provider, rather than being silently skipped.

### `InMemoryEmailOutbox` / `EmailModule` (`infrastructure/email/`)
The only `EmailSender` the app binds. **No email provider has been chosen**, so nothing is
delivered: `send()` appends a `SentEmail` (recipient, subject, body, `sentAt` from the injected
`Clock`) to an in-process array, and `sentTo(recipient)` reads them back **newest first**.

`EmailModule` is `@Global()` and binds `EmailSender` with `useExisting`, so application code
injects the port while the testing endpoints inject the concrete outbox. **Choosing a real
provider later is a single binding change in that module.** `clear()` throws everything away (the
truncate endpoint calls it); being in memory, the outbox is also per-process and lost on restart.

Ordering is by **insertion**, not by `sentAt`: `sentTo` reverses the array rather than sorting on
the timestamp, because under `NODE_ENV=test` the clock is pinned and several messages routinely
share an identical `sentAt`.

### `ProblemDetail`
RFC 9457 problem detail builder.
- `ProblemDetail.forUnknownError()` — 500 fallback, with `about:blank` as its type.
- `ProblemDetail.fromHttpException(ex)` — wraps a NestJS `HttpException`.
- Constructor: `(typeUri, title, status, detail?, instance?, extensionMembers?)`.
- `.asResponseBody()` — serialises to the JSON response shape.

`typeUri` is a **slug, not a URL** — pass `user-already-exists` and `asResponseBody()` prefixes
`TYPE_BASE_URL` (`https://my-api-doc.dev/problems`); `about:blank` passes through untouched.
`extensionMembers` are **spread at the top level** of the body, not nested under a key, which is
how `errors` and `entityId` end up as siblings of `title` and `status`.

That base URL is a separate `const` in `problem-detail.ts` and in `swagger/error-schemas.ts`, and is
copied once more outside this project, with no shared constant. Changing one breaks the others
silently.

### `ExceptionMapper` (interface)
Strategy for mapping exceptions to `ProblemDetail`:
```ts
canMap(exception: unknown): boolean
toProblemDetail(exception: unknown): ProblemDetail
```

### `HttpExceptionFilter`
Global `@Catch()` filter. Walks a chain of `ExceptionMapper`s; the first whose `canMap()` is true
wins, otherwise `ProblemDetail.forUnknownError()`. Sets `Content-Type: application/problem+json`.

**The chain is a hardcoded `const ExceptionMappers` array at the top of `exception.filter.ts`**:
`FrameworkExceptionMapper` first, then `Identity`, `Products`, `ManufacturingInstructions` and
`Boms` mappers (`audit-logging` throws nothing of its own). It is not DI: the filter is registered
as `new HttpExceptionFilter()` in `configure-app.ts` and can inject nothing. Adding a module mapper
means editing this framework file — the one place `framework` may name a feature module, and the
one exception `framework-independent-of-modules` whitelists. Forget it and the module's exceptions
become 500s.

`FrameworkExceptionMapper` handles `BadRequestException` (→ 400 `validation-error`, reading the
`ValidationPipe`'s `{ field, message }[]` into `errors`), any other `HttpException` (passed
through, e.g. the guards' 401/403), and `EntityNotFound` (→ 404 `entity-not-found` with `entityId`).

### `JwtAuthGuard`
Validates the `Authorization: Bearer <token>` header and sets `{ sub: userId }` on the request.
Throws `UnauthorizedException` on missing or invalid tokens.

It takes `(jwtService: JwtService, clock: Clock)` and verifies with a `clockTimestamp` taken from
the injected clock rather than from the machine, so under `NODE_ENV=test` **token expiry follows
test-controlled time**. Issuance has to stamp `iat` from the same clock for this to work — see
`identity`'s `JwtTokenService`.

### `@Roles(...roles)` / `ROLES_KEY` / `RolesGuard` (`http/decorators/roles.decorator.ts`, `http/roles.guard.ts`)
`@Roles(Role.SystemAdmin, …)` sets `ROLES_KEY` metadata on a handler or controller. `RolesGuard`
reads it (handler overrides class) and, when present, asks `UserRoleProvider` for the caller's
**current** role on every request — never a token claim, since a role can change or the account be
deleted before the token expires. `null` (unknown or deleted user) or a role not listed is a 403
`ForbiddenException`. No `@Roles()` means the guard lets everyone through.

It must run **after** `JwtAuthGuard`, which populates `request.user`:
`@UseGuards(JwtAuthGuard, RolesGuard)`. A route with `JwtAuthGuard` alone (every report, list and
the dashboard) never re-checks the user, so a soft-deleted user's token keeps working there until
it expires.

### `AuthModule` (`http/auth.module.ts`)
`@Global()`, imported once in `AppModule`. Registers `JwtModule` via
`ConfigService.getOrThrow('JWT_SECRET')` (1h expiry) and provides and exports `JwtAuthGuard`,
`RolesGuard` and `JwtModule`. `RolesGuard`'s `UserRoleProvider` is not bound here — it resolves
from `identity`'s global module.

### `AuthenticatedUser` + `@CurrentUser()` decorator
`AuthenticatedUser` holds `id: Identity`. `@CurrentUser()` wraps `request.user.sub` in one; use it
only behind `JwtAuthGuard`.

### `ActorContextMiddleware` / `ActorContextModule` (`http/actor-context.*.ts`)
The `ActorContext` binding. `AppModule.configure()` applies the middleware to every route; it
`decode()`s — never verifies; `JwtAuthGuard` remains the gate — a bearer token's `sub` and runs the
rest of the request inside an `AsyncLocalStorage` holding it. It never rejects a request: no
header, a malformed one, or an empty `sub` all mean "no actor". `ActorContextModule` is `@Global()`
and binds `ActorContext` with `useExisting: ActorContextMiddleware`.

**The `AsyncLocalStorage` lives at module scope in `actor-context.middleware.ts`, not on the
instance, and must stay there.** A class used both as `MiddlewareConsumer.apply()` middleware and
as an injected provider is not guaranteed to be one instance, and in the running app it wasn't:
`use()` wrote to one object's store while the audit projector read another's, so every audit
entry was silently skipped as "no actor" (a `warn`, invisible under the test stack's
`LOG_LEVEL=silent`). The spec's "a second, independently constructed instance sees the actor a
first instance recorded" pins this. Any future class with the same dual role needs the same
module-scope state.

### `HealthModule` / `HealthController` (`http/health/`)
`GET /health` (reached at `/api/health`) returns `200 {"status":"ok"}`. It is the Compose
healthcheck for `app`, and deliberately dependency-free: it reports whether HTTP is answering, not
whether Postgres is (`db` has its own `pg_isready` check). Mounted in every environment.

### `TestingModule` / `TestingController` / `TestingService` (`http/testing/`)
Testing-support endpoints, consumed only by an external black-box test runner — never by
application code. Reached under `/api/testing/*`; the controller is `@SkipThrottle()`. The five
writing ones answer **204 No Content**:
- `POST /testing/migrations` — runs `prisma migrate deploy` via `execFile`.
- `POST /testing/truncate` — `TestingService.truncateAll()`, the clean slate, in three steps:
  truncate every `public` table but `_prisma_migrations` (`RESTART IDENTITY CASCADE`), clear the
  `InMemoryEmailOutbox`, then **await `PostTruncateHook.run()`** — which re-seeds `identity`'s
  default admin, so the response doesn't return until that account exists again.
- `POST /testing/clock` — pins the clock to the instant in the body (`SetClockDto`).
- `POST /testing/clock/advance` — moves it forward by a duration (`AdvanceClockDto`).
- `POST /testing/clock/reset` — returns it to `DEFAULT_INSTANT`.

The sixth reads, and answers **200** with `SentEmailView[]`:
- `GET /testing/emails?to=<address>` — what the outbox holds for that address, **newest first**,
  as `{to, subject, body, sentAt}` with `sentAt` an ISO string. `ListEmailsDto` puts `@IsEmail()`
  on `to`, so a malformed address is a 400 rather than a 500 out of `Email.fromString`.

`TestingService` takes `(prisma: PrismaService, clock: TunableClock, outbox: InMemoryEmailOutbox,
postTruncateHook: PostTruncateHook)` — the concrete clock and outbox, since only this module reads
back what the rest of the app may only write.

`AppModule` imports `TestingModule` only when `process.env.NODE_ENV === 'test'` — an equality, not
`!== 'production'`, so these endpoints are absent from development too and exist only on the
dedicated test stack.

### Swagger Helpers (`infrastructure/http/swagger/`)
Pre-built schemas for `@ApiResponse` decorators (`error-schemas.ts`):
- `ValidationErrorSchema` — 400 validation errors
- `EntityNotFoundSchema` — 404 with entity ID
- `JwtUnauthorizedSchema` — 401 unauthorized
- `domainErrorSchema(typeUri, title, status, detail?, extensionMembers?)` — generic factory

`xlsxDownloadResponse(fileName)` (`xlsx-download-response.ts`) is the `@ApiOkResponse` for an
`.xlsx` download, a binary body.

### Spreadsheet export (`infrastructure/spreadsheet/`)
What every `.xlsx` download is built from. A feature module shapes its rows into a plain
`SpreadsheetGrid` (`(string | number)[][]`, header row first) and hands it on:

- `renderXlsxWorkbook(grid, options?): Promise<Buffer>` — one sheet, via `write-excel-file`'s Node build.
  Strings stay text (an MI code `1001` is not turned into a number), numbers stay numbers.
  `options` is `XlsxWorkbookOptions`: `{ rightToLeft: true }` writes a right-to-left sheet view
  (column A on the right); left to right by default.
- `layOutXlsxSheet(grid)` (not exported from the barrel) — the pure layout applied first: columns
  fitted to their longest value (header counted bold, wide glyphs double, capped at 60 so long text
  wraps), wrapped rows given the height they need, a thin black border on every cell, and a bold
  header on a `#F2F2F2` fill.
- `xlsxAttachment(buffer, fileName): StreamableFile` — the response: `XLSX_CONTENT_TYPE` and a
  `Content-Disposition: attachment` built by the `content-disposition` package (RFC 5987
  `filename*` for a Persian name). `XLSX_CONTENT_TYPE` is exported so the Swagger helper and any
  other caller share one constant.
- `buildComponentMaterialColumns` — the «جز n»/«مواد اولیه n»/«وزن n» slot triples (one per
  material line, n in Persian digits, as many slots as the longest exported BOM, `-` in a slot a
  BOM lacks) both BOM exports use for their one-row-per-BOM layout; `formatJalaliDateTime(instant,
  timeZone)` — the Latin-digit Jalali `yyyy/MM/dd HH:mm` a cell carries.

These are presentation, so they are infrastructure: a controller calls them on its query's read
model; no handler returns a grid or a buffer.
