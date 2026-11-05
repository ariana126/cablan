# Daily BOMs (`src/modules/boms/`)

A daily BOM ("آنالیز روزانه") registers, against a specific work order, a snapshot of a standard
BOM's composition: an order number, a tracking number, an optional description, and a composition
of components/materials with the weights actually measured, cloned from a **standard BOM** at
registration — one level down the clone chain Product → ManufacturingInstruction → Bom. This module
also owns the review (approve / reject), each edit's reason and edit details, re-sampling a rejected one, the report and its export, and the daily dashboard — and the **orders** («سفارشات», issue #101) a daily BOM is registered for (see [Orders](#orders-سفارشات-issue-101)). Follows the vertical-slice
layout in `backend/CLAUDE.md`'s "Architecture" section.

## Endpoints

| Route | Guard | Handler |
|---|---|---|
| `POST /boms` | `@Roles(QcInspector, Management, SystemAdmin)` | `RegisterBomHandler` |
| `PATCH /boms/:id` | same | `EditBomHandler` |
| `DELETE /boms/:id` | same | `DeleteBomHandler` (hard delete) |
| `POST /boms/:id/approval` / `POST /boms/:id/rejection` | `@Roles(...BOM_REVIEWER_ROLES)` (Management, SystemAdmin) | `ApproveBomHandler` / `RejectBomHandler` |
| `POST /boms/:id/resampling` | `@Roles(QcInspector, Management, SystemAdmin)` | `ResampleBomHandler` |
| `GET /boms` | `@Roles(...PRODUCTION_ROLES)` (the four production roles) | `ListBomsHandler` |
| `GET /boms/:id` | same | `GetBomHandler` |
| `GET /boms/:id/weight-differences` | same | `GetBomWeightDifferencesHandler` |
| `POST /boms/report` | same | `ReportBomsHandler` |
| `POST /boms/report/export` | same | `ExportBomsHandler` |
| `GET /boms/report/filter-options` | same | `BomFilterOptionsHandler` |
| `POST /boms/dashboard` | same | `ListDashboardProductsHandler` |
| `POST /boms/dashboard/:productId/daily-boms` | same | `GetProductDailyBomsHandler` |
| `GET /orders` / `GET /orders/:id` / `GET /orders/by-number/:orderNumber` | `@Roles(...PRODUCTION_ROLES)` | `ListOrdersHandler` / `GetOrderHandler` / `GetOrderByNumberHandler` |
| `POST /orders` / `POST /orders/:id/mi-codes` / `PATCH /orders/:id` / `DELETE /orders/:id` | `@Roles(...ORDER_WRITER_ROLES)` (Management, SystemAdmin) | `DefineOrderHandler` / `AddOrderMiCodeHandler` / `EditOrderHandler` / `DeleteOrderHandler` |

The first eleven rows are `BomController` (`@Controller('boms')`); the dashboard pair is
`BomDashboardController` (`@Controller('boms/dashboard')`, tag `boms-dashboard`); the order rows
`OrderController` (`@Controller('orders')`, tag `Orders`), whose roles `src/route-roles.spec.ts`
pins. Every read is open
to all four production roles (`PRODUCTION_ROLES`, `@framework/domain`): "گزارشگیر" (Reporter),
excluded from every write, is exactly who the reports and the dashboard exist for. The maintenance
roles reach none of them (issue #69). The list is named explicitly, not left to `JwtAuthGuard`
alone, so a new role reaches nothing by default.

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
throws a plain `Error` if another caller bypasses the DTO. A scalar-only edit never touches the
factory. The dashboard's inline weight edit is this same `PATCH /boms/:id`, sending
`standardBomMiCode` and the lines' `componentId`/`materialId` back.

Usually the code only locates the composition to clone from. Since issue #101 it can also **change
the daily BOM's MI code** — see [Orders](#orders-سفارشات-issue-101): when the composition's
standard BOM is another one *and* its code differs from the stored one, the daily BOM is re-pointed.
The same standard BOM under a renamed code, or another standard BOM found under the stored code (one
the digit normalisation left behind, below), is still no change.

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

`Bom.register()` fixes five fields alongside `standardBomId`: `standardBomMiCode`, `brand`,
`productName` and `standardLength` (from the `ManufacturingInstructionReadModel` the factory
already fetched, so no extra round trip) and `registeredBy`. `registeredBy` never changes; the
other four move together with `standardBomId` only when an edit re-points the daily BOM at another
MI code of its order (issue #101, `Bom.editRepointed()` with a `BomRepointing` — the
`StandardBomClone` and the composition cloned from it, one value, so a re-pointing without its
composition cannot be built). A System Admin's correction
rewrites `productName` in place (below). They let the reports read a filterable row per BOM without a live join into
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
`registeredAtFrom`/`registeredAtTo` range on `createdAt` are plain columns. Sort is fixed, on the
report and the export alike: registration order descending — `createdAt`, then
`registrationSequence` (see Re-sampling, below) for BOMs registered at one instant.

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

**Two filters are the dashboard's own** (issue #70): `orderNumber` and `trackingNumber`, one free
text each (`@IsOptional() @IsString()` on both DTOs) — not the report's multi-value
`orderNumbers`/`trackingNumbers`. Each is trimmed; absent, empty or whitespace-only means
unfiltered; otherwise a daily BOM matches when its number **contains** the text,
case-insensitively (Prisma `contains` + `mode: 'insensitive'`, i.e. `ILIKE '%…%'`), so «TRK-600»
and «6001» both match TRK-6001. `toBomWhere` in `PrismaBomDashboardRepository` ANDs them on top
of the report's `where`, so they combine with the date range, the approval filters and each other
on both reads, counts and newest registration included. The search text is **not** passed through
`toAsciiDigits`, so «۶۰۰۱» does not match a stored TRK-6001.

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
`standardBomMiCode`, `approvalStatus`/`reviewedBy`/`managementNote` and `editHistory`, so the page
can show who registered it, its review and its edit details, and send an inline weight or
description edit back through `PATCH /boms/:id` (with `editSource: 'dashboard'` and a reason; see
Review, below). An unknown `productId` is
a 200 with `items: []`, not a 404.

**Two consequences of how this is built.**
- `PrismaBomDashboardRepository` queries `prisma.manufacturingInstruction` — another module's
  table — to map standard BOMs to products. ADR 0004 says only the owning module reads its tables;
  this is one of the two places that don't hold (the other is the correction propagator, below), and
  dependency-cruiser cannot see either (no TypeScript import is involved). Daily BOMs whose standard BOM has been deleted drop out of both endpoints.
- `GetManufacturingInstructionDetailQuery` throws `EntityNotFound` for an MI code that no longer
  exists, and the handler doesn't catch it — so one daily BOM whose standard BOM's code was renamed
  makes the whole per-product request a 404.

## A System Admin's correction rewrites the snapshots (issue #110)

When a product, component or material in use is corrected with `applyToRelatedRecords` (see
`products/CLAUDE.md`), `PrismaBomsCorrectionPropagator`
(`infrastructure/persistence/boms-correction.propagator.ts`) rewrites, in the correction's
transaction, a daily BOM's `bom.product_name` and its composition's `bom_component.name`/
`bom_material.name` (by `component_id`/`material_id`) — and, for a product, the orders' MI-code
snapshots' `bom_order_mi_code.product_name` (by `product_id`). This module's own correctable record,
an order's number, is the [Orders](#orders-سفارشات-issue-101) section's. **Nothing else of a daily BOM moves**: not its
weights, not its review (`approval_status`, `reviewed_by`, `management_note`,
`pending_review_changes` — a reviewed BOM is **not** returned to pending), not its `edit_history`,
whose stored change lines are history and keep the names they were written with. No event, no
`Bom` aggregate, no audit entry of a daily BOM's. Two traps:

- **`bom.updated_at` must not move.** It is `@updatedAt`, and a pre-#73 pending review edit is dated
  by it on read (`toPendingReviewEdits`, above). So the product name goes through raw SQL
  (`$executeRaw`), which leaves it alone; the composition tables carry no such column and use
  `updateMany`.
- **A daily BOM stores its standard BOM's id, not its product's.** The product's daily BOMs are
  found with `standard_bom_id IN (SELECT id FROM standard_bom WHERE product_id = …)` — a second read
  of `manufacturing-instructions`' table besides the dashboard's, equally invisible to
  dependency-cruiser. A standard BOM a daily BOM references cannot be deleted (issue #94), so none
  is missed.

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

**The per-BOM format has its own leading columns** (the per-material format's are unchanged):
شماره سفارش, شماره ردیابی, تاریخ و زمان ثبت, کنترلگر, کد MI, نام محصول, برند, متراژ استاندارد,
«وزن 1 متر», «وزن متراژ استاندارد», «اختلاف با استاندارد», توضیحات, then the three review columns
and the component/material/weight triples. The three computed weights are fields of
`BomExportItem`, filled in by `ExportBomsHandler`:

- `weightPerMeter` = Σ every material weight of the daily BOM, across components;
- `standardLengthWeight` = `weightPerMeter` × `standardLength`;
- `differenceFromStandard` = `standardLengthWeight` − (the standard BOM's **current** total ×
  `standardLength`) — signed: heavier is positive, lighter negative.

The handler reads each **distinct** MI code's standard BOM once through `StandardBomWeights`
(`StandardWeightTable.totalWeight()`). If that throws `EntityNotFound` (a renamed MI code), the
difference is `null` and its cell shows `-` — unlike the dashboard and the preview, one missing
standard BOM does not fail the export; any other error still does. Values in the read model are
exact apart from `roundWeight`'s noise removal; only the cell rounds them to 2 decimals, still as
numbers (`23`, not `23.00`).

The per-BOM sheet is laid out **right to left**: `bomExportWorkbookOptions(format)` (in
`bom-export-grid.ts`) returns `{ rightToLeft: true }` for `perBom` only, and the controller passes it
to `renderXlsxWorkbook`. The per-material sheet stays left to right.

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
- **An effective edit (one with change lines — see below) sends an approved or rejected BOM back
  to pending** as two events, in this order: `BomEdited` (only the edit's own changes), then
  `BomReturnedToPending(bomId, trackingNumber, changes)` — its tracking number taken *after* the
  edit. Both dispatch in the edit's one transaction, so the audit log gets `Edited` then
  `ReturnedToPending`. A no-change edit records nothing and leaves the review alone; an edit of a
  pending BOM records `BomEdited` alone; an edit refused (by a guard, or for a missing reason)
  changes nothing.
- **Change lines** (strings only, `''` for "none"): `approvalStatus`, `reviewedBy`, then
  `managementNote` only when it differs — so `ReturnedToPending` from an approval with no note has
  two lines, from a rejection three. audit-logging passes them through.

### Edit reason, review edits and corrections (issue #73)

Every **effective** edit — one that produces at least one change line (below) — needs a reason,
and is kept as a `BomEditRecord` (`domain/value/bom-edit-record.vo.ts`): `editedBy` (display
name), `editedAt`, `reason`, and its change lines. Which list it joins depends on what kind of edit
it is.

- **`PATCH /boms/:id` body**: `editReason?: string` (`@IsOptional() @IsString()` only, like
  `RejectBomDto.reason`, so a blank one reaches the domain) and `editSource?: 'dailyBoms' |
  'dashboard'` (`BomEditSource`, `@IsEnum`, default `dailyBoms`; the preview's «ویرایش» is
  `dailyBoms`). `BomController.update()` resolves `editedBy` through `DisplayNameProvider` (as
  `registeredBy`) and the role through `UserRoleProvider`; `EditBomHandler` takes `editedAt` from
  `Clock` and builds a `BomEditContext` (`domain/value/bom-edit-context.vo.ts`) for `Bom.edit()`.
- **Effective = has change lines.** `Bom.edit()` computes the lines first; none means a no-op:
  no reason needed, no `BomEdited`, no return to pending, no record. That includes a composition
  that differs only in re-cloned names (renamed upstream) or line order — it is adopted quietly.
  An effective edit with a missing, empty or whitespace-only reason throws `EditReasonRequired`
  (`domain/exceptions/`) → **400 `edit-reason-required`**, checked before anything is touched, so
  the BOM, its review and its events are left as they were. The reason is stored trimmed, with
  Persian/Arabic-Indic digits as English ones.
- **Review edit vs correction** (`BomEditContext.isReviewEdit()`): a review edit is an edit from
  the dashboard (`editSource: 'dashboard'`) by a reviewer — the one list `BOM_REVIEWER_ROLES`
  (`domain/value/bom-reviewers.ts`: Management, SystemAdmin), read through
  `BomEditor.withRole(role).isReviewer()`. Everything else is a correction, including a reviewer's
  edit from `/boms` and a non-reviewer who sends `dashboard` (treated as a correction, not
  refused). A review edit never enters the edit details; a correction never enters the note.
- **Change lines** (`domain/value/bom-edit-change.ts`, `changeLineOf()`), one Persian line each:
  material lines first, in the new composition's order with removed ones last, then the scalar
  fields (order number, MI code, tracking number, description — `EDITED_FIELDS`; the MI code since
  issue #101). The approved Gherkin
  fixes that order, and the edit details and a review edit's note block share it. Weights in their
  canonical number form (`3`, not `3.0`); an empty value reads `-`:
  - `وزن جز {component} مواد اولیه {material} از {old} به {new} تغییر کرد`
  - `{شماره سفارش|کد MI|شماره ردیابی|توضیحات} از {old} به {new} تغییر کرد` (`کد MI` is field
    `standardBomMiCode`, also in `BomEdited.changes` and so in the audit entry)
  - `مواد اولیه {material} با وزن {w} به جز {component} اضافه شد` / `... از جز {component} حذف شد`
    (a swapped component reads as one removal plus one addition).
- **Heading** (`BomEditRecord.heading()`): `کاربر {editedBy} در {yyyy/MM/dd} ساعت {HH:mm} به علت
  {reason} تغییرات زیر را انجام داد` — Jalali, Latin digits, 24-hour, always in **Asia/Tehran**
  (a stored record of when the plant saw the edit, not the reader's zone), via the framework's
  `jalaliDateAndTime`. It is rendered, never stored, so the edit details and the note can't
  disagree.
- **Edit details («جزئیات ویرایش»)**: each correction's record is appended to `Bom.editHistory()`,
  oldest first, never discarded. `GET /boms/:id`, every `POST /boms/report` item and every
  `POST /boms/dashboard/:productId/daily-boms` item carry `editHistory: BomEditRecord[]` —
  `{ editedBy, editedAt (ISO), reason, heading, changes }` (`BomEditRecordItem`,
  `application/queries/bom-edit-record.read-model.ts`; the named OpenAPI schema `BomEditRecord`
  is `infrastructure/http/bom-edit-record.schema.ts`, registered with `@ApiExtraModels`). The
  export does not carry it.
- **The management note**: review edits are kept as `PendingReviewEdits`
  (`domain/value/pending-review-edits.vo.ts`, persisted in `bom.pending_review_changes`) because
  edit and approve are separate requests. Approving renders them as the note — **one block per
  review edit, in order: its heading, then its change lines**, all joined by `\n` (none →
  `null`) — and clears them; rejecting uses the reason and clears them. There is no merging across
  edits any more (issue #73 dropped the per-field merge: with a reason per edit, folding two into
  one line would lose whose reason it was). A correction leaves them alone. A review edit of a
  reviewed BOM is appended *after* the return to pending, so it is the first of the next review.
- `BomEdited` and its audit entry are unchanged (no reason); `BomApproved`'s `managementNote`
  carries the rendered note.
- `Bom.fromPersistence()` refuses a reviewed BOM that still holds pending review edits.

### Storage, filters, migration

- Columns: `bom.approval_status` (`String`, default `'pending'`), nullable `bom.reviewed_by` and
  `bom.management_note`, `bom.pending_review_changes` and `bom.edit_history` (both `JSONB`,
  default `[]`, each an array of `{ editedBy, editedAt (ISO), reason, changes }` — the heading is
  never stored). No CHECK constraint: `BomReview.restore()` and `fromPersistence()` are the guard,
  and the column readers (`infrastructure/persistence/edit-history.column.ts`,
  `pending-review-changes.column.ts`) refuse a stored value they cannot read, like
  `toApprovalStatus()` does for the status.
- **Pre-#73 pending rows are converted on read, not by a migration.** Before issue #73,
  `pending_review_changes` held merged per-field changes (`{ kind: 'field' | 'material', … }`)
  with no editor, time or reason. `toPendingReviewEdits(column, rowUpdatedAt)` reads those as
  **one review edit by `-`, for `-`, at the row's `updated_at`**, ahead of any newer review
  edits, so the domain only ever sees `BomEditRecord`s; the next save of the row stores it in the
  new shape. `BomRecord.updatedAt` is read for exactly this and never written.
- Migration `20261028093632_daily_bom_edit_history` adds `bom.edit_history`
  (`JSONB NOT NULL DEFAULT '[]'`) — a plain `ADD COLUMN`, kept as Prisma drafted it.
- Migration `20261025082638_daily_bom_review` **renames** `approved_by` → `reviewed_by` and
  rewrites `'unapproved'` → `'pending'`. `prisma migrate dev --create-only` drafted it as a drop
  plus an add — which would have silently lost every recorded approver — and it was amended at
  creation. Any future column rename needs the same check of the generated draft.
- The report and export filters take `approvalStatuses` and `reviewers` (the absent-vs-`[]` rule
  above). In `reviewers`, `''` stands for "no reviewer" (a pending BOM) and matches
  `reviewed_by IS NULL`, which a SQL `IN` never would; a name matches the BOMs that reviewer
  approved **and** those they rejected. Filter options return `approvalStatuses` and `reviewers`
  (distinct, non-null, sorted). `GET /boms/:id`, report rows, export items and dashboard daily-BOM
  rows carry `approvalStatus`, `reviewedBy` and `managementNote` (and all but the export,
  `editHistory`).
  `test/integration/bom-approval.int-spec.ts` pins the review against a real database (see
  `backend/CLAUDE.md`) — including the note's heading block from a dashboard review edit, a
  correction leaving a pending review edit in the note, a pre-#73 pending row converted on read,
  and `edit_history` round-tripping through the column, the detail and the report row; `test/integration/bom-dashboard-filters.int-spec.ts` pins the dashboard's
  counts, `''` and `[]`, and its order/tracking-number searches (trimmed, case-insensitive
  substring, ANDed, blank = unfiltered).

## Re-sampling ("نمونه گیری مجدد")

When the latest daily BOM of a tracking number is rejected, it can be re-sampled: a **new,
ordinary daily BOM** is registered with its order number, tracking number and MI code (not
editable, so not in the request) and only the new weights and an optional description from the
caller. Issue #72.

- **The rule** is stated once, in `domain/service/resampling.policy.ts`:
  `resamplingRefusal(approvalStatus, isLatestOfTrackingNumber)` returns `'not-rejected'`,
  `'not-latest'` (in that order of precedence) or `null`, and `isResamplable(...)` is "no refusal".
  Re-samplable = rejected **and** the latest daily BOM of its (current) tracking number. Nothing is
  stored: another BOM's registration, tracking-number edit or deletion changes "latest", so it is
  computed on every read and write.
- **Latest = registration order**: `createdAt`, then `bom.registration_sequence` — a `SERIAL`
  column (migration `20261027112214_bom_registration_sequence`, with an index on
  `(tracking_number, created_at, registration_sequence)`) — because under the test stack's pinned
  clock every BOM shares one `createdAt`. Same tie-breaker idea as `audit_log_entry.sequence`.
  Existing rows were numbered when the column was added. `InMemoryBomRepository` uses the same
  definition: the registration instant it stamps on first save (or `seed(bom, registeredAt)`), then
  insertion order.
- **The fact** comes from one raw SQL `EXISTS` with a row comparison, `idsWithLaterRegistration()`
  (`infrastructure/persistence/later-registration.ts`), shared by both sides:
  `BomRepository.isLatestOfItsTrackingNumber(id)` (on `txHost.tx`) and `PrismaBomReportRepository`,
  whose `BomReportItemRecord`/`BomDetailRecord` carry `isLatestOfTrackingNumber`. Prisma's query
  API has no correlated `EXISTS`, hence the raw SQL.
- **Read side:** `ReportBomsHandler` and `GetBomHandler` turn that into **`resamplable: boolean`**
  on every `POST /boms/report` item and on `GET /boms/:id`, through `isResamplable`. The frontend
  shows the button from it and never re-derives the rule. Export and dashboard rows do not carry it.
- **`POST /boms/:id/resampling`** — body `ResampleBomDto` = `PickType(RegisterBomDto,
  ['components', 'description'])`, so the same nested
  `components: [{ componentId, materials: [{ materialId, weight }] }]` and validation as
  registration (weight required and positive → 400 `validation-error`; `orderNumber`,
  `trackingNumber` or `standardBomMiCode` in the body is a 400 too, via `forbidNonWhitelisted`).
  `registeredBy` is the acting user, resolved like registration's. **201 `{ id }`** — the new BOM's
  id, not registration's full `BomReadModel`. Unknown id → 404 `entity-not-found`.
- **The aggregate decides:** `source.resample(isLatestOfTrackingNumber, standardBomId, brand,
  productName, standardLength, components, description, registeredBy): Bom` takes the order
  number, tracking number and MI code from the source and delegates to `Bom.register()` — pending,
  `BomRegistered`, the usual audit entry. On a refusal it throws `BomNotResamplable`, a
  `DomainException` in `domain/exceptions/` like `BomAlreadyReviewed` → **409
  `bom-not-resamplable`** with extension members `approvalStatus` (the source's) and **`reason`**
  (`'not-rejected'` | `'not-latest'`). The source is never changed, records nothing and is never
  saved. The new BOM keeps the source's id as `resampledFromId()` (issue #94), persisted in
  nullable `bom.resampled_from_id` (no foreign key; migration
  `20261102122447_bom_resampled_from`, a plain `ADD COLUMN` with **no backfill** — earlier
  re-samples left no trace). It is internal: no response carries it.
- **A re-sampled daily BOM is locked.** While its re-sample exists it can be neither edited nor
  deleted — 409 `record-has-dependents`, kind `resampled-daily-bom` (named by order number).
  `EditBomHandler` and `DeleteBomHandler` call the framework's `RecordDependencies` right after
  the 404 check. Approve, reject and resample are **not** guarded.
  `PrismaBomsDependentsProbe` (`infrastructure/persistence/boms-dependents.probe.ts`) answers
  for every reference this module holds: composition lines → Material, Component (`daily-bom`),
  `standard_bom_id` → StandardBom (`daily-bom`), `resampled_from_id` → Bom
  (`resampled-daily-bom`), and issue #101's two: an order's MI codes → StandardBom (`order`, named
  by the order number) and `order_number` → `order` (`daily-bom`). See `src/framework/CLAUDE.md`.
- **`ResampleBomHandler`**: load the source, ask `isLatestOfItsTrackingNumber`, check the
  composition invariants, clone the composition from the **source's stored `standardBomMiCode`**
  through `BomCompositionFactory` (so a renamed MI code is `bom-standard-bom-not-found`, as on an
  edit), call `source.resample(...)`, save the new BOM. Because the composition is built before
  the aggregate decides, an empty or invalid composition is its 400 even on a BOM that is not
  re-samplable.
- **No lock**: two concurrent re-samples of one rejected BOM can both pass the check. Accepted in
  the design — the duplicate is an ordinary, deletable daily BOM, and the flag turns off after one.
- `test/integration/bom-resampling.int-spec.ts` pins "latest" against Postgres on both sides:
  same-instant registrations still ordered, other tracking numbers ignored, a BOM the latest again
  once the later one is edited to another tracking number or deleted.

## Orders («سفارشات», issue #101)

An order is a unique order number with the MI codes (standard BOMs) assigned to it; a daily BOM is
registered only for a defined order, with one of its MI codes. Design:
`docs/superpowers/specs/2026-11-05-order-management-design.md`; the HTTP contract (routes, bodies,
`OrderReadModel`, problem types) is pinned in the plan beside it. It is an aggregate of this
module, not a module of its own: every order rule touches daily-BOM data (counting them, rewriting
their `order_number`, deleting them), which inside one module are plain same-transaction calls.

- **`Order`** (`domain/order.aggregate.ts`): `orderNumber` (this module's `OrderNumber`, Persian
  digits normalised) and `miCodes: OrderMiCode[]` in assignment order — each the standard BOM's id
  and a snapshot of its MI code and its product's id and name (`domain/value/order-mi-code.vo.ts`).
  Invariants: at least one MI code (a plain `Error`; the DTOs' `@ArrayMinSize(1)` makes it a 400
  `validation-error` on `miCodes` first), no standard BOM twice (`OrderMiCodeAlreadyAssigned` →
  **409 `order-mi-code-already-assigned`**). `define`, `addMiCode`, `edit(orderNumber, miCodes)`
  (miCodes replaced wholesale — but MI codes naming the same **set** of standard BOMs, in any order,
  are no change: the order keeps its own `OrderMiCode`s and records no `miCodes` line; no event when
  nothing changed), `delete` (also marks it `isDeleted()`); events `OrderDefined`,
  `OrderMiCodeAdded`, `OrderEdited` (`orderNumber`/`miCodes` lines, the codes `, `-joined),
  `OrderDeleted`, projected by audit-logging as record type `Order`.
- **The daily-BOM rules live on `Order`**, the handlers only load, delegate and save:
  `miCodeForDailyBom(typed?)` (the order's only code when none is chosen, else
  `BomMiCodeRequired`; a chosen one not on the order `BomMiCodeNotInOrder` — both
  `DomainException`s in `domain/exceptions/`), `assertHoldsStandardBom(id, miCode)` (a daily BOM moved
  onto the order) and `assertPermitsRepointing(from, to, toMiCode)` (both the order's, of one product
  by the order's own `productId` snapshots).
- **Every change to an existing order goes through `OrderRepository.modify(id, change)`**:
  `SELECT … FOR UPDATE` on the `bom_order` row, load, the (async) change, then save — or delete, when
  the change `delete()`d it — in one transaction, like `BomRepository.modify()`. A save rewrites
  every `bom_order_mi_code` row, so without the lock two concurrent "add MI code"s collided (one
  lost); add, edit and delete all use it, the delete's cascade and the edit's propagation running
  inside `change`, on the same transaction. `orders.int-spec.ts` pins it with two modifications
  forced to load at once.
- **Uniqueness** of the number is the handlers' check (`OrderRepository.findByOrderNumber`) with
  the unique index on `bom_order.order_number` as backstop, both → **409 `order-number-taken`**.
- **MI codes are resolved** by `StandardBomLookup` (`application/service/standard-bom-lookup.ts`)
  through `GetManufacturingInstructionByMiCodeQuery` — its own dependency-cruiser carve-out,
  `standard-bom-lookup-reuse-is-narrow`, kept apart from the composition factory's. Unknown →
  **400 `order-mi-code-not-found`** (`miCode` as typed).
- **Reads** go through `OrderReadRepository` (`application/service/`, Prisma on `PrismaService`):
  `{ id, orderNumber, miCodes: [{ standardBomId, miCode, productId, productName }], dailyBomCount }`,
  the list `{ items }` sorted by order number, `dailyBomCount` a `groupBy` of `bom` by
  `order_number`. `GET /orders/by-number/:orderNumber` (declared before `:id`) normalises digits;
  unknown → 404 with the number as `entityId`.
- **Storage**: `bom_order` (`order` is an SQL keyword) and `bom_order_mi_code` (unique
  `(order_id, standard_bom_id)`, `position` = assignment order, cascade on the order's delete). A
  daily BOM links to its order **by the number it stores** — no foreign key, no order id on `bom`
  (ADR 0004's snapshot convention).

### The dependency rule and the System Admin's exceptions

- An order's daily BOMs reference it (`ReferencedRecordType` **`order`** — lower-case, as the
  contract pinned it — kind `daily-bom`, named by the order number). `EditOrderHandler` goes through
  `RecordDependencies.editRecordInUse()` and `DeleteOrderHandler` calls `assertNoDependents()`;
  `AddOrderMiCodeHandler` is **not** guarded (adding a code changes no daily BOM).
- An order references each standard BOM it assigns (kind `order`, the `DEPENDENT_KINDS` entry
  between `standard-bom` and `daily-bom`), so a standard BOM assigned to an order can be neither
  edited nor deleted, even with no daily BOM.
- **Renumbering an order in use** is the System Admin's correction (`applyToRelatedRecords`,
  `CorrectableFields { name: orderNumber }`). `EditOrderHandler` resolves the typed MI codes first
  (`StandardBomLookup`, so an unknown code is its 400 even on an order in use), then
  `Order.changesOnlyCorrectableFields(miCodes)` compares the standard BOMs as a set — the same test
  `edit()` applies — true when the MI codes are left out or name the same standard BOMs in any order.
  Any other change of the MI codes of an order in use is never a correction: 409 for the System
  Admin too. A taken number is
  `order-number-taken`, checked inside `write`, so nothing is propagated. The propagator rewrites
  `bom.order_number` from the old number (the port's `before`) to the new one by raw SQL —
  `updated_at`, review, edit history untouched, no event, no daily-BOM audit entry; the order's own
  `Edited` entry is the record.
- **Deleting an order in use**: the System Admin's delete (`DeleteOrderCommand.deleterRole`, looked
  up by the controller through `UserRoleProvider`) deletes every daily BOM with that order number —
  directly, so a re-sampled one goes with its re-sample, bypassing `DeleteBomHandler`'s guard — each
  raising `BomDeleted` (its own audit entry), then the order, in one `UnitOfWork`. Management gets
  the 409.

### Daily BOM registration and edit

- **Register** (`RegisterBomHandler`): no order with the (normalised) number → **400
  `bom-order-not-defined`**; then `Order.miCodeForDailyBom()`: `standardBomMiCode` left out → the
  order's only MI code, or **400 `bom-mi-code-required`** when it has several; given but not on the
  order (digits normalised) → **400 `bom-mi-code-not-in-order`**. The order's stored code is what clones the
  composition and is stored as `standardBomMiCode`. `RegisterBomDto.standardBomMiCode` is optional
  (`@ValidateIf`, so `''`/`null` are still refused).
- **Edit** (`EditBomHandler`, after the re-sample guard): a changed `orderNumber` must name a
  defined order (`bom-order-not-defined`) holding the daily BOM's standard BOM
  (`Order.assertHoldsStandardBom` → `bom-mi-code-not-in-order`). A new MI code (see "Editing
  composition" above) goes to `Order.assertPermitsRepointing` on the (possibly new) order: it must
  hold both the old and the new standard BOM, of one product by its own `productId` snapshots (a
  daily BOM keeps only its product's name) — else `bom-mi-code-not-in-order`; so moving to another
  order *and* MI code in one edit needs an order holding both. A new code needs `components` (without
  them it is `bom-must-have-at-least-one-component`). `Bom.editRepointed()` then re-points
  `standardBomId`, `standardBomMiCode`, `brand`, `productName`, `standardLength` with a `کد MI`
  change line, the usual reason, edit history and return to pending. Fields left unchanged are not checked, so a legacy daily BOM edits as before.
- **Re-sampling** is unchanged: the new BOM keeps the source's order and MI code (an order never
  loses a used MI code).

### The legacy carry-over and the test-stack endpoints

Migration `20261105095505_order_management` creates the two tables (Prisma's draft, purely
additive). `20261105095534_order_backfill` is the carry-over, one idempotent `DO` block: one order
per distinct `bom.order_number` (`ON CONFLICT DO NOTHING`), one assignment per distinct
`(order_number, standard_bom_id)` it lacks, in first-use order (`registration_sequence`), the
snapshot from `standard_bom` — a third read of `manufacturing-instructions`' table, invisible to
dependency-cruiser. It touches no `bom` row; a daily BOM whose standard BOM is gone carries nothing
over.

`BomsTestingModule` (`infrastructure/testing/`, mounted by `AppModule` at `NODE_ENV === 'test'`
only, like `MaintenanceTestingModule`; no sign-in, `@SkipThrottle()`):

- `POST /api/testing/boms/legacy-daily-boms` — body `LegacyDailyBomDto` (`RegisterBomDto` with
  `standardBomMiCode` required) → **201 `{ id }`**: a daily BOM registered as before issue #101, for
  any order number, by `RegisterLegacyBomHandler` (provided by this testing module only, never by
  `BomsModule`). An optional bearer token names the registrant (and the audit entry's actor, through
  `ActorContext`); without one `registeredBy` is `-` and no audit entry is written.
- `POST /api/testing/boms/order-backfill` → **204**: the `order_backfill` migration's SQL, read from
  `prisma/migrations` at run time (`order-backfill.ts`), so the endpoint and a deploy cannot drift.

`test/integration/orders.int-spec.ts` pins against Postgres: two MI codes added at once both
kept (`modify()`'s lock); the correction carried into
`bom.order_number` with the rest of the row (`updated_at` included) unchanged and only the order's
`Edited` entry written; a taken number changing nothing; MI-code removal refused to the System
Admin; Management's delete refused and the System Admin's taking every daily BOM (a re-sample and
its source) with one `Deleted` entry each; a standard BOM locked by an order; the read side's sort,
assignment order and counts; and the backfill re-run twice (idempotent, no `bom` row changed,
missing assignments added to an order already defined).
