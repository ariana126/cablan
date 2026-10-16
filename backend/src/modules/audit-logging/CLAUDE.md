# Audit Logging (`src/modules/audit-logging/`)

A system-wide audit trail ("گزارش رویدادهای سیستم") of every mutating event across the other six
modules — `identity`, `products`, `components`, `materials`, `manufacturing-instructions`, `boms` — viewable only
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
read models — from `identity`, `products`, `components`, `materials`, `manufacturing-instructions` and `boms`.
This is the same category of justified exception as the composition-factory reuse carve-outs
(`ProductCompositionFactory`, `ManufacturingInstructionCompositionFactory`, `BomCompositionFactory`,
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
| `UserRegistered` | User | Registered | `name`, `username`, `role` — **never** the password or its hash |
| `UserDeleted` | User | Deleted | `name`, `username`, `role` as they stood |
| `UserEdited` | User | Edited | the event's own `changes` (one line per field that really changed) |
| `ProductRegistered` / `ProductDeleted` | Product | Registered / Deleted | `name`, then one `component` line per component |
| `ComponentRegistered` / `ComponentDeleted` | Component | Registered / Deleted | `name` |
| `MaterialRegistered` / `MaterialDeleted` | Material | Registered / Deleted | `name`, `code` (left out when the material has none) |
| `Product/ComponentRenamed` | Product/Component | Edited | one `name` line (never emitted when the name is unchanged) |
| `MaterialEdited` | Material | Edited | the event's own `changes` — a `name` and/or `code` line, one per field that really changed (an absent code reads as `''`) |
| `ManufacturingInstructionRegistered` / `ManufacturingInstructionDeleted` | StandardBom | Registered / Deleted | `miCode`, `productName`, `brand`, `standardLength`, `active`, `description`, then one `component` line per component |
| `BomRegistered` / `BomDeleted` | Bom | Registered / Deleted | `orderNumber`, `trackingNumber`, `miCode` (its standard BOM's), `productName`, `brand`, `standardLength`, `description`, `registeredBy`, then one `component` line per component |
| `ManufacturingInstructionEdited` / `BomEdited` | StandardBom / Bom | Edited | the event's own `changes`, then `component` lines when the same edit replaced the composition (see below) |

`UserPasswordChanged` and `ProductComponentsUpdated` (a *product's own* composition) are
deliberately **not** wired up — neither appears in the acceptance scenario's list of tracked
actions, and a password change carries no field a client is entitled to see.

**One update, one entry.** Each aggregate's `edit()` computes the diff itself, while old values are
still on hand, and records a single `*Edited` event carrying only the fields that actually changed.
A field resent unchanged is never a change, and an edit that changes nothing records no event, so
no entry is written. `MaterialEdited` replaced the old `MaterialRenamed` when materials gained an
optional `code`, so a single edit changing name and code is still one entry with two lines.

## What an entry's changes contain

**Every entry carries details** — none is ever written with empty `changes`. All three actions use
the one `{ field, previousValue, newValue }` line shape, so the HTTP response
(`GET /audit-log/:id/changes`) did not change:

- **Registered** — one line per field the record was registered with: `previousValue: ''`,
  `newValue: <value>`.
- **Deleted** — the same fields, as the record stood when deleted: `previousValue: <value>`,
  `newValue: ''`.
- **Edited** — the diff, as above.

The keys of a Registered/Deleted entry are the same ones that record's `Edited` entries already use
(`miCode`, `standardLength`, …), so a field reads the same whichever action it appears under.

To make that possible, every `*Registered`/`*Deleted` event carries a plain-data snapshot of its
aggregate — flat fields for `User`, `Material`, `Component`, `Product`; a `snapshot` object for
`ManufacturingInstruction`/`Bom`, typed in `domain/events/manufacturing-instruction.snapshot.ts` / `bom.snapshot.ts`; a
product's composition in `domain/events/product-component.snapshot.ts`. Those snapshot files sit
under `domain/events/`, so the handlers still import nothing from the source modules but
`domain/events/*.ts` and the `audit-logging-event-handlers-reuse-is-narrow` carve-out is unchanged.
Internal ids (`productId`, `standardBomId`) travel in the snapshots but are not projected — the
`productName`/`miCode` beside them is what a reader can use.

`application/service/audit-snapshot.ts` is the one place a snapshot becomes lines, so the rendering
is identical across all six record types:

- **Values are strings**: a number in its decimal form (`305.5`), a boolean as `'true'`/`'false'`
  (as `ManufacturingInstructionEdited` already renders `active`), a role as its enum value (`system_admin`, …).
- **A field with no value** (`null`, `undefined`, `''` — a material without a code, a BOM without a
  description) is **left out**, not shown as an empty-to-empty line.
- **Fields come first, in a fixed order, then the composition.**

**Compositions** are rendered as one line per component, field key `component`, in composition
order:

```
<component>: <material>، <material>                      (product — materials carry no weight)
<component>: <material> (<grams> گرم)، <material> (<grams> گرم)   (standard BOM, BOM)
```

e.g. `Core: Copper (12.5 گرم)، PVC (3 گرم)` — materials joined by the Persian comma `، `, weights in
grams with the Persian unit. Every component line has at least one material (each module's
component-line value object enforces it), so a line is never a bare name.

**An edit that replaces a composition.** `ManufacturingInstructionEdited`/`BomEdited` carry
`replacedComposition: { previous, current } | null` (formerly a bare `componentsReplaced` boolean,
which produced entries with empty `changes` when nothing else differed).
`compositionReplacementChanges()` turns it into `component` lines appended after the field changes:
components are paired by name (the n-th "Core" before with the n-th "Core" after); a changed one
reads before → after, a removed one before → `''`, an added one `''` → after, an unchanged one is
left out. The aggregate reports a replacement whenever line identity or order differs, so a
composition merely **reordered** has no name/content difference — in that case every position is
listed before → after instead, which is what guarantees the entry is never empty.

**Line order is stored.** `audit_log_entry_change.position` (migration
`20261010115910_add_audit_change_position`) is the line's 0-based index within its entry, written by
`PrismaAuditLogRepository.record()` and used to order `findChangesByEntryId()`. Change rows have
random UUID ids and no timestamp, so without it a registration's lines would read back in whatever
order Postgres returns them.

**Old rows are not backfilled.** Entries written before this change keep the details they were
written with: `Registered`/`Deleted` entries (and components-only edits) from then still resolve to
`changes: []`, and their change rows all read `position = 0` (the column's default), so they keep
the unordered read-back they always had.

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

## Excel-style filters

Mirrors `boms`' report. `POST /audit-log` takes `{ page, pageSize, filters? }` with
`filters.actors`, `filters.recordTypes` and `filters.actions` as multi-value arrays (absent =
unfiltered, `[]` = match nothing; `in: [...]` in Prisma) plus a single free-text `filters.recordId`
and the `from`/`to` range. `GET /audit-log/filter-options` (`AuditLogFilterOptionsHandler` →
`AuditLogRepository.filterOptions()`) returns the unfiltered distinct `{ actors, recordTypes,
actions }`, sorted ascending, to populate those lists. There is no flat `actorName` any more.

## The list query never fetches change rows

`AuditLogEntry`/`AuditLogEntryChange` are two separate Prisma models specifically so the list query
(`ListAuditLogHandler` → `AuditLogRepository.search()`) never joins or selects change rows — viewing
one entry's field-level changes is a *separate* request (`GET /audit-log/:id/changes` →
`GetAuditLogChangesHandler` → `AuditLogRepository.findChangesByEntryId()`). A client paging through
the list never pays for change data it isn't displaying.
