# Daily BOMs (`src/modules/boms/`)

A daily BOM ("آنالیز روزانه") registers, against a specific work order, a snapshot of a standard
BOM's composition: an order number, a tracking number, an optional description, and a composition
of components/materials with the weights actually measured, cloned from a **standard BOM** at
registration — one level down the clone chain Product → ManufacturingInstruction → Bom. This module
also owns approval, the report and its export, and the daily dashboard. Follows the vertical-slice
layout in `backend/CLAUDE.md`'s "Architecture" section.

## Endpoints

| Route | Guard | Handler |
|---|---|---|
| `POST /boms` | `@Roles(QcInspector, Management, SystemAdmin)` | `RegisterBomHandler` |
| `PATCH /boms/:id` | same | `EditBomHandler` |
| `DELETE /boms/:id` | same | `DeleteBomHandler` (hard delete) |
| `POST` / `DELETE /boms/:id/approval` | `@Roles(Management, SystemAdmin)` | `ApproveBomHandler` / `RevokeBomApprovalHandler` |
| `GET /boms` | `JwtAuthGuard` only | `ListBomsHandler` |
| `GET /boms/:id` | `JwtAuthGuard` only | `GetBomHandler` |
| `POST /boms/report` | `JwtAuthGuard` only | `ReportBomsHandler` |
| `POST /boms/report/export` | `JwtAuthGuard` only | `ExportBomsHandler` |
| `GET /boms/report/filter-options` | `JwtAuthGuard` only | `BomFilterOptionsHandler` |
| `POST /boms/dashboard` | `JwtAuthGuard` only | `ListDashboardProductsHandler` |
| `POST /boms/dashboard/:productId/daily-boms` | `JwtAuthGuard` only | `GetProductDailyBomsHandler` |

The first five rows are `BomController` (`@Controller('boms')`); the dashboard pair is
`BomDashboardController` (`@Controller('boms/dashboard')`, tag `boms-dashboard`). Every read is
deliberately role-free: "گزارشگیر" (Reporter), excluded from every write, is exactly who the
reports and the dashboard exist for.

## Layout, and where it departs from ADR 0009

The tree is flat and layered like every module. ADR 0009 asks for capture, reporting and the
dashboard to be separate component directories inside `boms`, and for the registration and
dashboard carve-outs into `manufacturing-instructions` to become one. Neither has happened: the
three concerns are told apart by file names and their own read ports (`BomReportRepository`,
`BomDashboardRepository`) and two controllers, and `.dependency-cruiser.cjs` still has two separate
rules, `bom-composition-factory-reuse-is-narrow` and `bom-dashboard-handler-reuse-is-narrow`.

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
`PrismaBomDashboardRepository`), not the report port or the write-side `BomRepository`. Both take
optional `from`/`to` instants, inclusive on both ends against `createdAt` and added only when
present.

**`POST /boms/dashboard`** returns only products with at least one daily BOM in range, each with
`dailyBomCount` and `lastRegisteredAt`, sorted by product name ascending. The handler is a 1:1
mapping; the repository does the work. A daily BOM stores `productName` and `standardBomId`, not
`productId`, so it groups `bom` by `(productName, standardBomId)` in SQL, then resolves each
`standardBomId` to its `productId` with a second query and merges and sorts the groups in JS.

**`POST /boms/dashboard/:productId/daily-boms`** returns the product's daily BOMs in range. The
repository finds the product's standard BOMs, then their daily BOMs, flattened to one row per
material. The handler, `GetProductDailyBomsHandler`, does the scoring:

- It dispatches one `GetManufacturingInstructionDetailQuery` per **distinct** MI code among the
  records, memoising each standard BOM's `(componentId, materialId)` → weight map, and joins each
  material line to it — the same pair `BomCompositionFactory` uses at registration. The
  `bom-dashboard-handler-reuse-is-narrow` carve-out limits it to that query and its
  `ManufacturingInstructionDetail`.
- Each `ProductDailyBomLine` carries `actualWeight`, `standardWeight` and `difference`, the
  **absolute** deviation (2 under and 2 over both read `2`). A line no longer on the standard BOM's
  current composition is scored against `standardWeight: 0`, never skipped — surfacing exactly that
  drift is the point. The BOM's `score` is Σ `difference`.
- Weights are `Float` doubles, so `difference` and `score` are rounded to 6 decimals
  (`roundWeight`), which removes subtraction noise (`6.3 - 6.1` = `0.20000000000000018`) without
  touching any weight a person enters.
- The result is sorted by score descending **in the handler**, after the join.

Each `ProductDailyBom` also carries `trackingNumber`, `registeredBy`, `description`,
`standardBomMiCode` and `approvalStatus`/`approvedBy`, so the page can show who registered it, its
approval, and send an inline weight edit back through `PATCH /boms/:id`. An unknown `productId` is
a 200 with `items: []`, not a 404.

**Two consequences of how this is built.**
- `PrismaBomDashboardRepository` queries `prisma.manufacturingInstruction` — another module's
  table — to map standard BOMs to products. ADR 0004 says only the owning module reads its tables;
  this is the one place that doesn't hold, and dependency-cruiser cannot see it (no TypeScript
  import is involved). Daily BOMs whose standard BOM has been deleted drop out of both endpoints.
- `GetManufacturingInstructionDetailQuery` throws `EntityNotFound` for an MI code that no longer
  exists, and the handler doesn't catch it — so one daily BOM whose standard BOM's code was renamed
  makes the whole per-product request a 404.

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
where the server runs. A missing description is a plain `-`. «وضعیت تایید»/«تایید کننده» follow
«توضیحات» in both formats: `تایید شده`/`تایید نشده`, and the approver's name or `-`.

## Approval ("تایید آنالیز روزانه")

Approval is state of the `Bom` aggregate, not a module of its own: its one invariant — an edit
voids an approval — is enforced by the same aggregate that performs edits, in the same
transaction. `BomApproval` holds status and approver as one fact (approved ⇔ an approver is
named; `restore()` rejects any other stored pair). `approvedBy` is a cloned display name,
resolved by `BomController.approve()` through `DisplayNameProvider` exactly like
`registeredBy`.

- `Bom.approve(name)` records `BomApproved`; `revokeApproval()` records `BomApprovalRevoked`.
  Each is a no-op on a BOM already in that state — no event, the first approver stands — and
  `ApproveBomHandler`/`RevokeBomApprovalHandler` then return **without saving**, so a no-op
  can't overwrite an edit that committed meanwhile. Both endpoints still answer 204.
- `Bom.edit()` that really changes something (fields or composition) sends an approved BOM
  back to unapproved and appends `approvalStatus`/`approvedBy` lines to the same
  `BomEdited.changes`. A no-change edit leaves the approval alone; a rejected edit never
  reaches the aggregate.
- Change lines carry strings only, so "no approver" is `''` in them (wire: `null`). The
  status strings (`approved`/`unapproved`) are `ApprovalStatus`' values and live only in this
  module; audit-logging passes the events' `changes` through.
- Storage: `bom.approval_status` (`String`, default `'unapproved'`, read back through
  `toApprovalStatus()`, which rejects an unknown value) and nullable `bom.approved_by`. The
  migration that added them left every existing daily BOM unapproved. There is no database
  CHECK on the pair: Prisma can't declare one; `BomApproval.restore()` is the guard.
- The report and export filters gain `approvalStatuses` and `approvers` (the absent-vs-`[]`
  rule above). In `approvers`, `''` stands for "no approver" («بدون تایید کننده») and matches
  `approved_by IS NULL`, which a SQL `IN` never would; `['مصطفی', '']` is "approved by مصطفی, or
  unapproved". Filter options gain `approvalStatuses` and `approvers` (distinct, non-null,
  sorted). `test/integration/bom-approval.int-spec.ts` pins the `''` case against a real database.
