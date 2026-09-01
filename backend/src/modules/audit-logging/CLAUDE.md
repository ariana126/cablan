# Audit Logging (`src/modules/audit-logging/`)

A system-wide audit trail ("گزارش رویدادهای سیستم") of every mutating event across the other six
modules — `identity`, `products`, `components`, `materials`, `standard-boms`, `boms` — viewable only
by `Role.SystemAdmin`. Unlike every other module, this one has **no aggregate and no write model of
its own**: it is a pure CQRS read-side projector, following the same vertical-slice layout as the
rest (`backend/CLAUDE.md`'s "Architecture" section) minus the `domain/` layer, which this module has
no need for.

## Why there's no `domain/` layer here

Every other module's `domain/` holds an aggregate, its value objects, and the domain events it
emits. This module emits none of its own — it only *subscribes* to events the other six already
emit — and it enforces no business invariant of its own that would need an aggregate to protect. The
one thing that would normally live in `domain/service/` (a repository port) instead lives in
`application/service/audit-log.repository.ts`, matching `handbook:oop-guideline`'s "Read Models and
Layers" section: a *read-model* repository interface belongs in the application layer, not the
domain layer — the same place `boms`' own `BomReportRepository` lives, for the same reason (see
`boms/CLAUDE.md`).

## The one legitimate cross-module dependency: knowing another module's event shape

`application/event-handlers/**` — one `@EventsHandler` class per subscribed domain event, grouped
into one directory per source module — import exactly one `domain/events/*.ts` class from one of the
six source modules each. `.dependency-cruiser.cjs`'s `modules-isolated` rule forbids this in general;
`audit-logging-event-handlers-reuse-is-narrow` carves out exactly this directory, and pins it to
importing only `domain/events/*.ts` files — no aggregates, no repositories, no application code, no
read models — from `identity`, `products`, `components`, `materials`, `standard-boms` and `boms`.
This is the same category of justified exception as the composition-factory reuse carve-outs
(`ProductCompositionFactory`, `StandardBomCompositionFactory`, `BomCompositionFactory`,
`GetProductDailyBomsHandler`) already documented in those modules' own `CLAUDE.md`s: a module
occasionally has a real reason to know a fixed, narrow slice of another module's shape, and the rule
says so explicitly rather than leaving it as an unenforced convention.

Every handler is a thin one-liner: map the event's fields onto
`AuditLogProjector.project(recordType, recordId, action, changes?)` and return. The actual logic —
resolving the actor, writing the row — lives in one place, `AuditLogProjector`
(`application/service/audit-log-projector.service.ts`), which is what's actually unit-tested
heavily; each handler's own spec (grouped one file per source module, e.g.
`application/event-handlers/identity/identity-audit.handlers.spec.ts`) only proves the field mapping
is correct, using a fake projector.

## Which events are wired up, and what each maps to

`recordType` is one of `User | Product | Component | Material | StandardBom | Bom`; `action` is one
of `Registered | Edited | Deleted` — there is no fourth action for a components-update. Every
mutating event across the six modules maps to exactly one `(recordType, action)` pair:

| Source event | recordType | action | changes |
|---|---|---|---|
| `UserRegistered` | User | Registered | — |
| `UserDeleted` | User | Deleted | — |
| `UserRenamed` | User | Edited | one `name` line |
| `UsernameChanged` | User | Edited | one `username` line |
| `UserRoleChanged` | User | Edited | one `role` line |
| `Product/Component/MaterialRegistered` | Product/Component/Material | Registered | — |
| `Product/Component/MaterialRenamed` | Product/Component/Material | Edited | one `name` line |
| `Product/Component/MaterialDeleted` | Product/Component/Material | Deleted | — |
| `StandardBomRegistered` / `BomRegistered` | StandardBom / Bom | Registered | — |
| `StandardBomEdited` / `BomEdited` | StandardBom / Bom | Edited | the event's own `changes` |
| `StandardBomDeleted` / `BomDeleted` | StandardBom / Bom | Deleted | — |
| `StandardBomComponentsUpdated` / `BomComponentsUpdated` | StandardBom / Bom | Edited | — |

`UserPasswordChanged` and `Product/StandardBomComponentsUpdated`'s sibling for a *product's own*
composition (`ProductComponentsUpdated`) are deliberately **not** wired up — neither appears in the
acceptance scenario's list of tracked actions, and a password change carries no field a client is
entitled to see (see that event's own doc comment).

`*ComponentsUpdated` events carry only the new composition's component ids, not a comparable
old/new value pair, so they project with an empty `changes` array — same as a `Registered`/`Deleted`
entry. Only `StandardBomEdited`/`BomEdited` carry a real diff, computed inside
`StandardBom.edit()`/`Bom.edit()` themselves by comparing each field's old value (still on hand
before the aggregate overwrites it) against the new one, including only fields that actually changed
— see those two aggregates' own `edit()` doc comments. That is a deliberately narrow scope: no other
event in this codebase was enriched with a diff for this feature.

## Resolving "who did this": `ActorContext`, not a controller parameter

A domain event carries no actor — none of the six modules' events were touched to add one (see
`backend/CLAUDE.md`'s "what NOT to do" for this feature). Instead, `framework/infrastructure/http/`
gained `ActorContextMiddleware`: a global middleware, applied to every route in
`AppModule.configure()`, that decodes (never verifies — `JwtAuthGuard` remains the actual
authorization gate) a bearer token's `sub` claim and makes it available for the rest of the request
via `AsyncLocalStorage`, behind the `ActorContext` port (`@framework/domain`, mirroring `Clock`'s own
"abstract port in domain, concrete binding in infrastructure" shape). `AuditLogProjector` reads
`ActorContext.currentUserId()` at projection time — which happens synchronously later in the same
request, since `PrismaEntityRepository.save()` calls `EventBus.publishAll()` (unawaited, but still
within the same async context chain) right after the command's own database write.

`AuditLogProjector` then resolves the actor's *display name* through the already-existing
`DisplayNameProvider` port (the same one `BomController.register()` uses for `registeredBy`) and
stores it as a denormalized `actorName` snapshot on the entry — never a live join back into
`identity`, so a later rename or deletion of the acting user never rewrites history.

**A real bug this shape produced, worth knowing before touching `ActorContextMiddleware` again:**
`ActorContextMiddleware` is unique among this codebase's ports in being used *both* as
`MiddlewareConsumer.apply()` middleware (in `AppModule.configure()`) *and* as a regular DI-injected
provider (`ActorContextModule`'s `useExisting: ActorContextMiddleware` binding, which
`AuditLogProjector` depends on via the `ActorContext` token). NestJS does not guarantee those two
resolution paths land on the same singleton instance — in the running app they didn't: `use()` ran
on one `ActorContextMiddleware` object while the projector's injected `ActorContext` was a
*different* one, so every audit entry silently skipped projection ("no actor in context", logged at
`warn`, invisible under the test stack's `LOG_LEVEL=silent`) even though every request carried a
valid bearer token — `audit_log_entry` stayed empty through dozens of real mutations. The fix moved
the `AsyncLocalStorage` out of a per-instance field to **module scope** in
`actor-context.middleware.ts`, so it's shared regardless of how many `ActorContextMiddleware`
objects Nest constructs. `actor-context.middleware.spec.ts`'s "a second, independently constructed
instance sees the actor a first instance recorded" test encodes this invariant directly — it
constructs two separate instances (mirroring Nest's two resolution paths) and would fail again
against a per-instance store. Any future port with this same "both middleware and injected
provider" shape needs the same module-scope treatment, not a per-instance field.

If there is no actor in context (shouldn't happen behind a guarded mutating endpoint, but
defensive), or *anything* fails while resolving the name or writing the row, `AuditLogProjector`
logs and returns rather than throwing: an audit-projection failure must never fail the business
command it's reacting to. This is enforced twice over — `PrismaEntityRepository.save()` never awaits
`EventBus.publishAll()` in the first place, and the projector's own `try`/`catch` means a rejected
promise there can't even become an unhandled rejection.

## The list query's day-boundary `to` filter

`POST /audit-log`'s `to` filter is documented as inclusive of the **entire calendar day** it names,
not merely up to that exact instant — an event at `10:00` must still match a `to` of `00:00` the same
day. `ListAuditLogHandler.endOfCalendarDayExclusive()` is the one place this is computed: it takes
`to`'s UTC calendar date (discarding whatever time-of-day was given) and returns the *next* day's UTC
midnight, which `AuditLogRepository.search()`/`PrismaAuditLogRepository` then use as an **exclusive**
upper bound (`occurredAt < to`). `from`, by contrast, stays a plain inclusive lower bound
(`occurredAt >= from`) — only `to` gets the calendar-day treatment, matching the acceptance
scenario's own asymmetry.

## The list query never fetches change rows

`AuditLogEntry`/`AuditLogEntryChange` are two separate Prisma models specifically so the list query
(`ListAuditLogHandler` → `AuditLogRepository.search()`) never joins or selects change rows — viewing
one entry's field-level changes is a *separate* request (`GET /audit-log/:id/changes` →
`GetAuditLogChangesHandler` → `AuditLogRepository.findChangesByEntryId()`). A client paging through
the list never pays for change data it isn't displaying.
