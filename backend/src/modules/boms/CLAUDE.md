# Daily BOMs (`src/modules/boms/`)

A daily BOM ("آنالیز روزانه") registers, against a specific work order, a snapshot of a standard
BOM's composition: an order number, a tracking number, an optional description, and a composition
of components/materials with the weights actually measured, cloned from a **standard BOM** at
registration — one level down the clone chain Product → ManufacturingInstruction → Bom. This module
also owns the review (approve / reject), the report and its export, and the daily dashboard. Follows the vertical-slice
layout in `backend/CLAUDE.md`'s "Architecture" section.

## Endpoints

| Route | Guard | Handler |
|---|---|---|
| `POST /boms` | `@Roles(QcInspector, Management, SystemAdmin)` | `RegisterBomHandler` |
| `PATCH /boms/:id` | same | `EditBomHandler` |
| `DELETE /boms/:id` | same | `DeleteBomHandler` (hard delete) |
| `POST /boms/:id/approval` / `POST /boms/:id/rejection` | `@Roles(...BOM_REVIEWER_ROLES)` (Management, SystemAdmin) | `ApproveBomHandler` / `RejectBomHandler` |
| `GET /boms` | `JwtAuthGuard` only | `ListBomsHandler` |
| `GET /boms/:id` | `JwtAuthGuard` only | `GetBomHandler` |
| `GET /boms/:id/weight-differences` | `JwtAuthGuard` only | `GetBomWeightDifferencesHandler` |
| `POST /boms/report` | `JwtAuthGuard` only | `ReportBomsHandler` |
| `POST /boms/report/export` | `JwtAuthGuard` only | `ExportBomsHandler` |
| `GET /boms/report/filter-options` | `JwtAuthGuard` only | `BomFilterOptionsHandler` |
| `POST /boms/dashboard` | `JwtAuthGuard` only | `ListDashboardProductsHandler` |
| `POST /boms/dashboard/:productId/daily-boms` | `JwtAuthGuard` only | `GetProductDailyBomsHandler` |

The first ten rows are `BomController` (`@Controller('boms')`); the dashboard pair is
`BomDashboardController` (`@Controller('boms/dashboard')`, tag `boms-dashboard`). Every read is
deliberately role-free: "گزارشگیر" (Reporter), excluded from every write, is exactly who the
reports and the dashboard exist for.

## Layout, and where it departs from ADR 0009

The tree is flat and layered like every module. ADR 0009 asks for capture, reporting and the
dashboard to be separate component directories inside `boms`, and for the registration and
dashboard carve-outs into `manufacturing-instructions` to become one. Neither has happened: the
three concerns are told apart by file names and their own read ports (`BomReportRepository`,
`BomDashboardRepository`) and two controllers, and `.dependency-cruiser.cjs` still has two separate
rules, `bom-composition-factory-reuse-is-narrow` and `standard-bom-weights-reuse-is-narrow`.

## Cloning from the standard BOM

Registering (or editing) a composition takes a standard BOM's MI code and
`(componentId, materialId, weight)` triples. `BomCompositionFactory`
(`application/service/bom-composition.factory.ts`) reads the standard BOM's **current**
composition, rejects any pair not on it, and clones each pair's ids and names plus the caller's
weight into the daily BOM's own `BomComponentLine`/`BomMaterialLine`. It works exactly like
`manufacturing-instructions`' own factory one level up (see that module's `CLAUDE.md`), including
the single input shape for register and edit, and `PATCH` replacing the whole composition when
`components` is given.

- **The read goes through the `QueryBus`**: `GetManufacturingInstructionByMiCodeQuery`, the only
  thing (with its `ManufacturingInstructionReadModel`) the
  `bom-composition-factory-reuse-is-narrow` carve-out lets the factory import.
- **Keyed by MI code, as a plain string**, because that is how a person identifies a standard BOM.
  `boms` may not import `MiCode`, so the string crosses the boundary and becomes one only inside
  `manufacturing-instructions`. `buildComposition()` returns the resolved `standardBomId` along
  with the lines, in one round trip.
- **Errors are re-thrown as this module's 400s**: an unknown MI code's `EntityNotFound` becomes
  `BomStandardBomNotFound`, and a pair not on the standard BOM is `BomCompositionEntryNotFound`.

### Editing composition: the MI code comes from the request

`EditBomHandler` reclones from the MI code **in the command**, not the one the aggregate already
stores (`standardBomMiCode` was added to `Bom` for reporting after this edit path was written). So
`EditBomCommand.standardBomMiCode` is required whenever `components` is given: `UpdateBomDto`
enforces it with `@ValidateIf((dto) => dto.components !== undefined)` (a 400), and `EditBomHandler`
throws a plain `Error` if another caller bypasses the DTO. The code only locates the composition to
clone from — `Bom.updateComponents()` never reassigns `standardBomId` or the stored code. A
scalar-only edit never touches the factory. The dashboard's inline weight edit is this same
`PATCH /boms/:id`, sending `standardBomMiCode` and the lines' `componentId`/`materialId` back.

**A renamed MI code breaks re-lookup.** `manufacturing-instructions` lets an MI code be edited, and
a daily BOM keeps the code it cloned. After a rename, an edit with `components` that sends the
stored code is `BomStandardBomNotFound`, and the dashboard's per-product request for that product
fails outright with a 404 (see below).

## Field validation

`OrderNumber`/`TrackingNumber` are required, non-empty value objects of this module's own, and
material weights are required and non-zero; the value objects throw plain `Error`s. None of these
is an `ApplicationException`: the DTOs' `class-validator` rules turn an empty or missing value into
an ordinary 400 before a value object is built from untrusted input.

**Digits are normalised.** `OrderNumber`/`TrackingNumber` apply `toAsciiDigits`
(`@framework/domain`) in `fromString`, and the description — a plain string with no value object —
is normalised in `Bom.register()` and `Bom.edit()` (so `BomEdited`'s change line carries the
normalised value). Persian/Arabic-Indic digits are stored as English ones. The MI code a request
sends to find the standard BOM needs nothing here: it becomes an `MiCode` inside
`manufacturing-instructions`, which normalises it, so «۰۰۰۱» clones from standard BOM «0001». The
`normalise_persian_digits` migration rewrote this module's stored rows once, unconditionally —
order and tracking numbers, description, the cloned MI code, brand and product name, and the
composition names — since none of them is unique. A daily BOM whose standard BOM's MI code that
migration skipped (see `manufacturing-instructions/CLAUDE.md`) re-looks-up the *other* standard BOM
that already had the English code, on edit and on the dashboard.

## Fields cloned at registration for reporting

`Bom.register()` fixes five fields alongside `standardBomId`, all immutable afterwards:
`standardBomMiCode`, `brand`, `productName` and `standardLength` (from the
`ManufacturingInstructionReadModel` the factory already fetched, so no extra round trip) and
`registeredBy`. They let the reports read a filterable row per BOM without a live join into
`manufacturing-instructions` or `products` (ADR 0004).

`registeredBy` is the acting user's display name, resolved by `BomController.register()` through
`DisplayNameProvider` (`@framework/domain`, bound by `identity`) and passed into
`RegisterBomCommand` — infrastructure calling a port, as `RolesGuard` does with
`UserRoleProvider`, so the handler never reaches toward `identity`. A later rename never rewrites
who a report says registered a BOM.

## The reporting queries bypass `BomRepository` and the aggregate

`ReportBomsHandler`, `BomFilterOptionsHandler`, `ExportBomsHandler` and `GetBomHandler` go through
`BomReportRepository` (`application/service/`), a read-model port implemented by
`PrismaBomReportRepository`, which queries `bom`/`bom_component` directly for a projected shape and
never touches `BomMapper`. Loading every aggregate and slicing in JS (`ListBomsHandler`'s shape)
is fine for a small list; a report needs `WHERE`/`ORDER BY`/`LIMIT` in the database.

A filter field **absent** from `BomReportFilters` means unfiltered; present as `[]` means match
nothing — reporting-bom's "انتخاب دوباره همه مقادیر"/"عدم انتخاب هیچ مقداری" distinction.
`PrismaBomReportRepository.search()` keeps it for free (a condition is added only for a present key,
and Prisma's `{ in: [] }` matches nothing), and the DTOs keep it at the boundary (every filter
`@IsOptional()` with no default, so `transform: true` never coerces one into the other).

`componentNames` is the one filter across the `bom`/`bom_component` join; `brands`,
`standardBomMiCodes`, `productNames`, `registeredByUsers` and the inclusive
`registeredAtFrom`/`registeredAtTo` range on `createdAt` are plain columns. Sort is fixed:
`registeredAt` (`createdAt`) descending.

`GET /boms/:id` reads through `findDetailById()` too, because `registeredAt` is Prisma-managed
`createdAt` and was never part of the aggregate. `totalWeight` is computed in `GetBomHandler`.

## The dashboard ("داشبورد بررسی روزانه آنالیز های روزانه")

`ListDashboardProductsHandler` and `GetProductDailyBomsHandler` read through their own port,
`BomDashboardRepository` (`application/service/bom-dashboard.repository.ts`, implemented by
`PrismaBomDashboardRepository`), not the report port or the write-side `BomRepository`.

**Both take the same optional filters** (`BomDashboardFilters`, carried whole by each query):
`from`/`to` instants, inclusive on both ends against `createdAt`, and the report's `approvalStatuses` and
`reviewers` with exactly the report's semantics — absent = unfiltered, `[]` = match nothing,
several values = any of them, both filters = both must hold, `''` among the reviewers = no reviewer
(see Review, below). Nothing is copied to get there:
`DashboardProductsDto`/`ProductDailyBomsDto` `PickType` the two fields from `BomReportFiltersDto`
(validation and Swagger docs included), `BomDashboardFilters` `Pick`s them from
`BomReportFilters`, and `PrismaBomDashboardRepository` builds its `where` with the report's own
`toWhereInput` (the date range passed as `registeredAtFrom`/`registeredAtTo`). A change to the
report's approval filtering therefore changes the dashboard's too.

**`POST /boms/dashboard`** returns only products with at least one daily BOM in range matching the
filters, each with `dailyBomCount` and `lastRegisteredAt` computed over **the matching daily BOMs
only** (the filter is the `groupBy`'s `where`), sorted by product name ascending. The handler is a
1:1 mapping; the repository does the work. A daily BOM stores `productName` and `standardBomId`, not
`productId`, so it groups `bom` by `(productName, standardBomId)` in SQL, then resolves each
`standardBomId` to its `productId` with a second query and merges and sorts the groups in JS.

**`POST /boms/dashboard/:productId/daily-boms`** returns the product's daily BOMs in range matching
the filters. The repository finds the product's standard BOMs, then their daily BOMs, flattened to
one row per material. The handler, `GetProductDailyBomsHandler`, does the scoring:

- It asks `StandardBomWeights` (`application/service/standard-bom-weights.ts`) once per
  **distinct** MI code among the records. That service dispatches
  `GetManufacturingInstructionDetailQuery` and returns a `StandardWeightTable`, the standard BOM's
  `(componentId, materialId)` → weight map, and `differenceOf()` joins each material line to it —
  the same pair `BomCompositionFactory` uses at registration. The service, not the handler, is the
  file the `standard-bom-weights-reuse-is-narrow` carve-out lets import that query and its
  `ManufacturingInstructionDetail`.
- Each line, a `MaterialWeightDifference` (`application/queries/material-weight-difference.read-model.ts`), carries `actualWeight`, `standardWeight` and `difference`, the
  **absolute** deviation (2 under and 2 over both read `2`). A line no longer on the standard BOM's
  current composition is scored against `standardWeight: 0`, never skipped — surfacing exactly that
  drift is the point. The BOM's `score` is Σ `difference`.
- Weights are `Float` doubles, so `difference` and `score` are rounded to 6 decimals
  (`roundWeight`, in the same service file), which removes subtraction noise (`6.3 - 6.1` = `0.20000000000000018`) without
  touching any weight a person enters.
- The result is sorted by score descending **in the handler**, after the join.

Each `ProductDailyBom` also carries `trackingNumber`, `registeredBy`, `description`,
`standardBomMiCode` and `approvalStatus`/`reviewedBy`/`managementNote`, so the page can show who
registered it, its review, and send an inline weight edit back through `PATCH /boms/:id`. An unknown `productId` is
a 200 with `items: []`, not a 404.

**Two consequences of how this is built.**
- `PrismaBomDashboardRepository` queries `prisma.manufacturingInstruction` — another module's
  table — to map standard BOMs to products. ADR 0004 says only the owning module reads its tables;
  this is the one place that doesn't hold, and dependency-cruiser cannot see it (no TypeScript
  import is involved). Daily BOMs whose standard BOM has been deleted drop out of both endpoints.
- `GetManufacturingInstructionDetailQuery` throws `EntityNotFound` for an MI code that no longer
  exists, and the handler doesn't catch it — so one daily BOM whose standard BOM's code was renamed
  makes the whole per-product request a 404.

## The post-registration preview ("پیش‌نمایش آنالیز روزانه")

`GET /boms/:id/weight-differences` answers `{ lines: MaterialWeightDifference[] }` for one daily
BOM: every material line, in composition order, with `actualWeight`, `standardWeight` and
`difference` — the same per-line numbers the dashboard shows, because `GetBomWeightDifferencesHandler`
reads the BOM through `BomReportRepository.findDetailById()` (as `GET /boms/:id` does) and compares
it through the same `StandardBomWeights`. It is read-only: no aggregate, no write, no audit entry.
An unknown id is the usual 404 `entity-not-found`; and, as on the dashboard, a standard BOM whose MI
code was renamed after registration also surfaces as a 404 (with the MI code as `entityId`), since
`GetManufacturingInstructionDetailQuery`'s `EntityNotFound` is not caught. The standard weight is
the standard BOM's **current** one, not a registration-time snapshot.

## Composition order follows the standard BOM

A daily BOM's components, and each component's materials, are laid out in **the standard BOM's
defined order**, whatever order the request listed them in: `BomCompositionFactory` sorts the
cloned lines by their counterparts' index in the `ManufacturingInstructionReadModel` (which
`manufacturing-instructions` returns in its stored order). `bom_component` and `bom_material` store
that as `position`, written from the array index by `toNestedCreate` in `bom.repository.ts`, and
every read that includes the composition orders by it — the aggregate load, `GET /boms/:id`, the
export, and the dashboard. Prisma guarantees no order for an `include` without an `orderBy`, so a
new read must add one. On the wire the order is plain array order.

The order is a clone too: reordering the standard BOM later does not reorder a registered daily
BOM. The migration that introduced `position` backfilled daily BOMs from their standard BOM's
positions, with lines no longer on the standard BOM last, in insertion order.

## The Excel export is rendered here, not by the client

`POST /boms/report/export` answers with the `.xlsx` file itself (`Content-Disposition: attachment`
with the RFC 5987 `filename*` `گزارش-آنالیز-های-روزانه.xlsx`). `ExportBomsHandler` returns the plain
export set (`BomExportResult`); turning it into rows is presentation, so `BomController.export()`
hands it to `buildBomExportGrid` (`infrastructure/spreadsheet/bom-export-grid.ts`), then to the
framework's `renderXlsxWorkbook` and `xlsxAttachment`.

The request names the row layout — `format`: `perMaterial` (one row per component material) or
`perBom` (one row per daily BOM, a «جز n»/«مواد اولیه n»/«وزن n» column triple per material line,
padded with `-`, built by the framework's `buildComponentMaterialColumns`) — and a required
`timeZone`, the reader's IANA zone: «تاریخ و زمان ثبت» is a Jalali date-time in Latin digits
(`1403/04/01 08:30`) **read in that zone**, because an export is read where its reader stands, not
where the server runs. A missing description is a plain `-`. «وضعیت تایید»/«تایید/رد کننده»/
«توضیحات مدیریت» follow «توضیحات» in both formats: `تایید`/`در انتظار تایید`/`عدم تایید`, the
reviewer's name, and the management note — each `-` when empty. A note of several lines stays one
cell, its lines kept apart by the `\n` it is stored with (the framework's layout wraps on it).

## Review ("تایید / عدم تایید آنالیز روزانه")

The review is state of the `Bom` aggregate, not a module of its own: its invariants — only a pending
BOM is reviewed, and an edit sends a reviewed BOM back to pending — are enforced by the same
aggregate that performs edits, in the same transaction. Issue #61 replaced the two-state approval
(and "revoke approval") with it.

`BomReview` (`domain/value/bom-review.vo.ts`) holds three facts as one: `status` ∈ `pending` |
`approved` | `rejected` (`ApprovalStatus`, also the wire and column values), `reviewedBy` (null ⇔
pending) and `managementNote` («توضیحات مدیریت»; null when pending, required non-blank when
rejected, optional when approved). `restore()` rejects any other stored combination.
`reviewedBy` is a cloned display name, resolved by the controller through `DisplayNameProvider`
exactly like `registeredBy`.

- **Approve / reject only from pending.** `Bom.approve(name)` records
  `BomApproved(bomId, reviewedBy, managementNote, trackingNumber, changes)`;
  `Bom.reject(name, reason)` records `BomRejected(...)` with the trimmed reason as the note. On an
  approved or rejected BOM both throw `BomAlreadyReviewed` → **409 `bom-already-reviewed`**
  (extension member `approvalStatus`); a missing, empty or whitespace-only reason throws
  `RejectionReasonRequired` → **400 `rejection-reason-required`** — checked before the status, so
  a blank reason on a reviewed BOM is the 400. Both exceptions are `DomainException`s in
  `domain/exceptions/`, mapped by `BomsExceptionMapper`. `RejectBomDto.reason` is only
  `@IsOptional() @IsString()` so a blank reason reaches the domain instead of becoming a
  `validation-error`. A refused review never reaches `save()`.
- **Edit, approve and reject serialise per BOM** through `BomRepository.modify(id, change)`:
  `SELECT … FOR UPDATE` on the `bom` row, then load, `change`, `save()` in one transaction — so of
  two concurrent reviews one gets `bom-already-reviewed`, and an approval can never overwrite an
  edit it loaded before (both pinned in `bom-approval.int-spec.ts`).
- **An edit that really changes something (fields or composition) sends an approved or rejected
  BOM back to pending** as two events, in this order: `BomEdited` (only the edit's own changes),
  then `BomReturnedToPending(bomId, trackingNumber, changes)` — its tracking number taken *after*
  the edit. Both dispatch in the edit's one transaction, so the audit log gets `Edited` then
  `ReturnedToPending`. A no-change edit records nothing and leaves the review alone; an edit of a
  pending BOM records `BomEdited` alone; a rejected edit never reaches the aggregate.
- **Change lines** (strings only, `''` for "none"): `approvalStatus`, `reviewedBy`, then
  `managementNote` only when it differs — so `ReturnedToPending` from an approval with no note has
  two lines, from a rejection three. audit-logging passes them through.

### Pending review changes and the automatic note

The note an approval records is built from the **edits by any reviewer during the current
review**, kept as `PendingReviewChanges` (`domain/value/pending-review-changes.vo.ts`) and
persisted in `bom.pending_review_changes` (JSON) because edit and approve are separate requests.

- **Who is a reviewer** is one list, `BOM_REVIEWER_ROLES` (`domain/value/bom-reviewers.ts`:
  Management, SystemAdmin). `@Roles(...BOM_REVIEWER_ROLES)` guards approve/reject with it, and
  `BomEditor.withRole(role).isReviewer()` (`domain/value/bom-editor.vo.ts`) reads it for an edit.
  `BomController.update()` looks the editor's **current** role up through `UserRoleProvider` (as
  `RolesGuard` does) and passes it in `EditBomCommand.editorRole`; `EditBomHandler` builds the
  `BomEditor` that `Bom.edit(..., editor)` takes. `PATCH /boms/:id` is the only edit path — the
  dashboard's inline weight edit and description dialog both use it.
- **Merging:** an effective edit by a reviewer is folded in per scalar field or
  (componentId, materialId) pair — the first previous value stands, the latest new value wins, and
  a value moved back to where it started drops out. An edit by anyone else clears them; a no-change
  edit leaves them. Approving renders them as the note (none → `null`) and clears them; rejecting
  uses the reason and clears them. A reviewer's edit of a reviewed BOM is merged *after* the return
  to pending, so it is the first of the next review.
- **Note format** — one Persian line each, joined by `\n`; scalar fields first (order number,
  tracking number, description, in that order — `REVIEWED_FIELDS`), then material lines in the
  BOM's composition order, removed ones last. Weights in their canonical number form (`3`, not
  `3.0`); an empty description reads `-`:
  - `وزن جز {component} مواد اولیه {material} از {old} به {new} تغییر کرد`
  - `{شماره سفارش|شماره ردیابی|توضیحات} از {old} به {new} تغییر کرد`
  - `مواد اولیه {material} با وزن {w} به جز {component} اضافه شد` / `... از جز {component} حذف شد`
    (a swapped component reads as one removal plus one addition).
- `Bom.fromPersistence()` refuses a reviewed BOM that still holds pending review changes;
  `toReviewChanges()` (`infrastructure/persistence/pending-review-changes.column.ts`) refuses a
  stored value it cannot read, like `toApprovalStatus()` does for the status.

### Storage, filters, migration

- Columns: `bom.approval_status` (`String`, default `'pending'`), nullable `bom.reviewed_by` and
  `bom.management_note`, and `bom.pending_review_changes` (`JSONB`, default `[]`). No CHECK
  constraint: `BomReview.restore()` and `fromPersistence()` are the guard.
- Migration `20261025082638_daily_bom_review` **renames** `approved_by` → `reviewed_by` and
  rewrites `'unapproved'` → `'pending'`. `prisma migrate dev --create-only` drafted it as a drop
  plus an add — which would have silently lost every recorded approver — and it was amended at
  creation. Any future column rename needs the same check of the generated draft.
- The report and export filters take `approvalStatuses` and `reviewers` (the absent-vs-`[]` rule
  above). In `reviewers`, `''` stands for "no reviewer" (a pending BOM) and matches
  `reviewed_by IS NULL`, which a SQL `IN` never would; a name matches the BOMs that reviewer
  approved **and** those they rejected. Filter options return `approvalStatuses` and `reviewers`
  (distinct, non-null, sorted). `GET /boms/:id`, report rows, export items and dashboard daily-BOM
  rows carry `approvalStatus`, `reviewedBy` and `managementNote`.
  `test/integration/bom-approval.int-spec.ts` pins the review against a real database (see
  `backend/CLAUDE.md`); `test/integration/bom-dashboard-filters.int-spec.ts` pins the dashboard's
  counts, `''` and `[]`.
