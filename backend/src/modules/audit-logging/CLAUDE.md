# Audit Logging (`src/modules/audit-logging/`)

A system-wide audit trail ("گزارش رویدادهای سیستم") of every mutating event across the other four
modules — `identity`, `products`, `manufacturing-instructions`, `boms` — viewable only by
`Role.SystemAdmin`. Unlike every other module, this one has **no aggregate and no write model of
its own**: it is a pure CQRS read-side projector, following the same vertical-slice layout as the
rest (`backend/CLAUDE.md`'s "Architecture" section) minus the `domain/` layer, which this module has
no need for.

## Why there's no `domain/` layer here

Every other module's `domain/` holds an aggregate, its value objects, and the domain events it
emits. This module emits none of its own — it only *subscribes* to events the other four already
emit — and it enforces no business invariant of its own that would need an aggregate to protect. The
one thing that would normally live in `domain/service/` (a repository port) instead lives in
`application/service/audit-log.repository.ts`, matching `handbook:oop-guideline`'s "Read Models and
Layers" section: a *read-model* repository interface belongs in the application layer, not the
domain layer — the same place `boms`' own `BomReportRepository` lives, for the same reason (see
`boms/CLAUDE.md`).

## The one legitimate cross-module dependency: knowing another module's event shape

`application/event-handlers/**` — one `@DomainEventHandler` class per subscribed domain event, grouped
into one directory per source module — import exactly one `domain/events/*.ts` class from one of the
four source modules each. `.dependency-cruiser.cjs`'s `modules-isolated` rule forbids this in general;
`audit-logging-event-handlers-reuse-is-narrow` carves out exactly this directory, and pins it to
importing only `domain/events/*.ts` files — no aggregates, no repositories, no application code, no
read models — from `identity`, `products`, `manufacturing-instructions` and `boms`. Material and component events
come from `products` (they were separate modules until ADR 0009), so their handlers live in
`application/event-handlers/products/`.
This is the same category of justified exception as the composition-factory reuse carve-outs
(`ManufacturingInstructionCompositionFactory`, `BomCompositionFactory`,
`StandardBomWeights`) already documented in those modules' own `CLAUDE.md`s: a module
occasionally has a real reason to know a fixed, narrow slice of another module's shape, and the rule
says so explicitly rather than leaving it as an unenforced convention.

Every handler is a thin one-liner: map the event's fields onto
`AuditLogProjector.project(recordType, recordId, action, changes?, subject?)` and return. The actual logic —
resolving the actor, writing the row — lives in one place, `AuditLogProjector`
(`application/service/audit-log-projector.service.ts`), which is what's actually unit-tested
heavily; each handler's own spec (grouped one file per source module, e.g.
`application/event-handlers/identity/identity-audit.handlers.spec.ts`) only proves the field mapping
is correct, using a fake projector.

## Which events are wired up, and what each maps to

`recordType` is one of `User | Product | Component | Material | StandardBom | Bom`; `action` is one
of `Registered | Edited | Deleted | Approved | ApprovalRevoked` — there is no separate action for a
components-update, and the last two exist for daily BOMs only. Every
mutating event across the four source modules maps to exactly one `(recordType, action)` pair:

| Source event | recordType | action | changes |
|---|---|---|---|
| `UserRegistered` | User | Registered | `name`, `username`, `role` — **never** the password or its hash |
| `UserDeleted` | User | Deleted | `name`, `username`, `role` as they stood |
| `UserEdited` | User | Edited | the event's own `changes` (one line per field that really changed) |
| `ProductRegistered` / `ProductDeleted` | Product | Registered / Deleted | `name`, then one `component` line per component |
| `ComponentRegistered` / `ComponentDeleted` | Component | Registered / Deleted | `name` |
| `MaterialRegistered` / `MaterialDeleted` | Material | Registered / Deleted | `name`, `code` |
| `Product/ComponentRenamed` | Product/Component | Edited | one `name` line (never emitted when the name is unchanged) |
| `MaterialEdited` | Material | Edited | the event's own `changes` — a `name` and/or `code` line, one per field that really changed |
| `ManufacturingInstructionRegistered` / `ManufacturingInstructionDeleted` | StandardBom | Registered / Deleted | `miCode`, `productName`, `brand`, `standardLength`, `active`, `description`, then one `component` line per component |
| `BomRegistered` / `BomDeleted` | Bom | Registered / Deleted | `orderNumber`, `trackingNumber`, `miCode` (its standard BOM's), `productName`, `brand`, `standardLength`, `description`, `registeredBy`, then one `component` line per component |
| `ManufacturingInstructionEdited` / `BomEdited` | StandardBom / Bom | Edited | the event's own `changes`, then `component` lines when the same edit replaced the composition (see below). Never approval lines: an edit that voided a daily BOM's approval is followed by its own `BomApprovalRevoked` entry |
| `BomApproved` / `BomApprovalRevoked` | Bom | Approved / ApprovalRevoked | the event's own `changes`: `approvalStatus` (`unapproved` ↔ `approved`) and `approvedBy` (`''` ↔ name). Subject: `trackingNumber` = the event's `trackingNumber` |

Only the last row sets a [subject](#an-entrys-subject); every other handler passes none.

**An edit that voids an approval is two entries.** `Bom.edit()` records `BomEdited`, then
`BomApprovalRevoked`, and both project in the edit's one transaction with the editor as actor: an
`Edited` entry with only the edit's own lines, then an `ApprovalRevoked` entry identical in shape
to a direct revoke's. Entries written before issue #58 instead carry the
`approvalStatus`/`approvedBy` lines at the end of the `Edited` entry; they were not backfilled.

`UserPasswordChanged` and `ProductComponentsUpdated` (a *product's own* composition) are
deliberately **not** wired up — neither appears in the acceptance scenario's list of tracked
actions, and a password change carries no field a client is entitled to see.

**One update, one entry.** Each aggregate's `edit()` computes the diff itself, while old values are
still on hand, and records a single `*Edited` event carrying only the fields that actually changed.
A field resent unchanged is never a change, and an edit that changes nothing records no event, so
no entry is written. `MaterialEdited` replaced the old `MaterialRenamed` when materials gained a
`code` (now required and unique), so a single edit changing name and code is one entry with two
lines.

## What an entry's changes contain

**Every entry carries details** — none is ever written with empty `changes`. Every action uses
the one `{ field, previousValue, newValue }` line shape (the response's `subject`, beside the
lines, is [separate](#an-entrys-subject)):

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
- **A field with no value** (`null`, `undefined`, `''` — a BOM without a description) is **left out**, not shown as an empty-to-empty line.
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

## An entry's subject

An entry may carry a **subject** — `{ field, value }`, the reference a reader identifies the
record by (`trackingNumber` / `TRK-3005`). It is not a change line: the details view asserts its
change table as "what changed", and a tracking number that did not change is not a change. Kept
generic so the log stays record-type-agnostic; only Bom `Approved`/`ApprovalRevoked` set one.

- Port: `AuditSubject` on `RecordAuditLogEntryInput.subject` (`null` when absent);
  `findChangesByEntryId()` returns `{ changes, subject }`.
- Storage: nullable `audit_log_entry.subject_field`/`subject_value` (migration
  `20261022094123_add_audit_subject_and_sequence`). Both or neither; earlier rows have neither.
- HTTP: `GET /audit-log/:id/changes` answers `{ changes: [...], subject: { field, value } | null }`
  (read models `AuditLogChanges`, `AuditLogSubject`).

## Same-instant entries: the `sequence` tie-breaker

The list sorts `occurredAt desc, sequence desc`. `audit_log_entry.sequence` is a Postgres `SERIAL`
(`@default(autoincrement())`, added by the same migration, which numbered existing rows), so it
follows insertion order even inside one transaction. It exists because one command can write two
entries at the same `occurredAt` — an edit and the approval revocation it caused, always under the
test stack's pinned `TunableClock` — and the revocation must list as the newer one
deterministically. The `occurredAt` index is `(occurred_at, sequence)` to match.
`bom-approval.int-spec.ts` pins the order against a real database. `InMemoryAuditLogRepository`
mirrors it (same-instant entries newest-recorded first).

## Resolving "who did this": `ActorContext`, not a controller parameter

A domain event carries no actor, and none of the source modules' events were changed to add one.
`AuditLogProjector` instead reads `ActorContext.currentUserId()` (`@framework/domain`) at projection
time. That works because the projection runs later in the same request, inside the command's own
write transaction, so it is still in the async context `ActorContextMiddleware` set up from the
bearer token. The middleware, its port and the module-scope `AsyncLocalStorage` it depends on — the
fix for a bug that once left `audit_log_entry` silently empty — are in `src/framework/CLAUDE.md`.

The projector then resolves the actor's *display name* through `DisplayNameProvider` (the port
`boms` uses for `registeredBy`) and stores it as a denormalized `actorName` on the entry — never a
live join into `identity`, so a later rename or deletion of the user never rewrites history.

## The transactional contract: no change without its entry, no entry without its change

An audit entry is written **in the same Postgres transaction** as the change it describes
(ADR 0007; the mechanics are `backend/CLAUDE.md`'s "Writes, transactions and domain events"). Every
handler here is a `@DomainEventHandler`, so `AuditLogProjector.project()` runs inside the
repository's `withTransaction()`; `PrismaAuditLogRepository.record()` and the actor-name lookup both
run on `txHost.tx`, while the read side (`search`, `filterOptions`, `findChangesByEntryId`) stays on
`PrismaService`.

A failure anywhere in the projection is therefore the command's failure: the transaction rolls
back with the aggregate's rows, and the client sees:

- **Writing `audit_log_entry`/`audit_log_entry_change` throws** — a 500 (no mapper matches a
  database error). Integration case "rolls back the change when its audit entry cannot be written".
- **Resolving the actor's display name throws** — `IdentityDisplayNameProvider.getName` calls
  `UserRepository.get`, whose `EntityNotFound` maps to a **404 `entity-not-found`**, not a 500.
  Reached only when the user's row is gone entirely: users are soft-deleted and `get` doesn't
  filter on `isDeleted`, so a "deleted" user still resolves and the change commits. Integration
  case "rolls back the change when the actor no longer exists".

The projector has no `try`/`catch`; don't add one back. We prefer "the change didn't happen" to
"the change happened without a record".

The one case skipped rather than failed is **no actor in context**: system actions with no human
behind them — `DefaultAdminSeeder` at boot and after the test stack's truncate. The projector logs a
warning and returns, and the change commits without an entry.

`test/integration/transactional-audit-trail.int-spec.ts` proves all of this against a real
Postgres (`make run-integration-tests`).

## The list query's day-boundary `to` filter

`POST /audit-log`'s `to` filter is documented as inclusive of the **entire calendar day** it names,
not merely up to that exact instant — an event at `10:00` must still match a `to` of `00:00` the same
day. `endOfCalendarDayExclusive()`, a function exported from `list-audit-log.handler.ts` and applied
by `ListAuditLogHandler`, is the one place this is computed: it takes
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
