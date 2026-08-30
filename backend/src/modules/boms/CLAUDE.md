# Daily BOMs (`src/modules/boms/`)

A daily BOM ("آنالیز روزانه") registers, against a specific work order, a snapshot of a standard
BOM's composition: an order number, a tracking number, an optional description, and a composition
of components/materials cloned from a **standard BOM** at the moment of registration — one level
down the clone chain from `standard-boms` (Product → StandardBom → Bom). Follows the same
vertical-slice layout as `standard-boms/` — see `backend/CLAUDE.md`'s "Architecture" section for the
general shape.

## Cloning, not referencing — same reasoning as `standard-boms`

Registering (or editing) a daily BOM's composition takes a standard BOM's MI code and a list of
`(componentId, materialId, weight)` triples the caller wants included. Every `componentId`/
`materialId` here must already exist in the referenced standard BOM's **current** composition, and
`BomCompositionFactory` (`application/service/bom-composition.factory.ts`) looks each one up and
clones its id and name — plus the caller-supplied `weight` — into the daily BOM's own owned
`BomComponentLine`/`BomMaterialLine` value objects. This is a real copy: once built, those value
objects hold no link back to the standard BOM, and a later change to the standard BOM's own
composition never retroactively changes an already-registered daily BOM.

## The read-side crossing into `standard-boms`

`BomCompositionFactory` reads a standard BOM's current composition through
`GetStandardBomByMiCodeQuery` (`standard-boms/application/queries/get-standard-bom-by-mi-code/`),
dispatched on the `QueryBus` — never a direct call into `standard-boms`' repository or domain
layer. This mirrors `StandardBomCompositionFactory`'s own crossing into `products`, one level up the
chain.

`.dependency-cruiser.cjs`'s `modules-isolated` rule forbids a module from importing another
module's code — this module's exception is carved out narrowly by
`bom-composition-factory-reuse-is-narrow`, which pins `BomCompositionFactory` to importing exactly
`GetStandardBomByMiCodeQuery` and the `StandardBomReadModel` type it returns, and nothing else from
`standard-boms`.

A standard BOM MI code that doesn't resolve surfaces as `standard-boms`' own `EntityNotFound` from
`GetStandardBomByMiCodeQuery` — a framework-generic 404 from `standard-boms`' own point of view.
`BomCompositionFactory` catches that specific case and re-throws `BomStandardBomNotFound`, a 400
from *this* module's point of view. A `componentId`/`materialId` pair that doesn't exist in the
standard BOM's current composition is rejected the same way, as `BomCompositionEntryNotFound`.

## Why the cross-module query is keyed by MI code, not by id

Unlike `GetProductQuery` (keyed by `productId: Identity`, since `standard-boms` already holds a
product's id directly), `GetStandardBomByMiCodeQuery` is keyed by the standard BOM's **business MI
code**, a plain `string` — because a daily BOM is registered against a standard BOM the same way a
person identifies it operationally, by its MI code, not its internal id. `RegisterBomCommand`
carries `standardBomMiCode: string` for exactly this reason: `boms` must not import `standard-boms`'
own `MiCode` value object (only the query and read model the dependency-cruiser rule whitelists), so
the raw string crosses the module boundary and is converted to `MiCode` only inside
`GetStandardBomByMiCodeHandler`, `standard-boms`' own code.

`BomCompositionFactory.buildComposition()` resolves that MI code to the standard BOM's actual id in
one round trip, returning both `standardBomId` (what `Bom.register()` fixes onto the new aggregate)
and the cloned `componentLines`.

## Editing composition without a stored MI code

`Bom` stores `standardBomId: Identity` — fixed at registration, not editable, mirroring
`StandardBom.productId()` — but **not** the standard BOM's MI code. `StandardBom`'s own edit path
reuses its already-stored `productId` directly to re-dispatch `GetProductQuery(productId)` when
components are replaced (see `standard-boms/CLAUDE.md`). `Bom` can't do the equivalent, because the
one cross-module query available is keyed by MI code, not by id, and the aggregate doesn't keep one.

So `EditBomCommand` carries `standardBomMiCode?: string`, optional at the type level like every
other field but `bomId` — yet required *in practice* whenever `components` is also given, since
that's the only way `EditBomHandler` can reclone the current composition. Two layers enforce the
pairing: `UpdateBomDto` guards it with `@ValidateIf((dto) => dto.components !== undefined)` on
`standardBomMiCode`, so an HTTP request that supplies `components` without `standardBomMiCode` is
an ordinary 400 validation error before a command is ever constructed; and `EditBomHandler` itself
throws a plain `Error` (a programmer/caller mistake knowable from the command's own shape, not a
domain rule — see `handbook:oop-guideline`'s exception-type test) if some other caller bypasses the
DTO and does the same. `standardBomMiCode` never changes what the `Bom`'s own `standardBomId`
resolves to: `Bom.updateComponents()` never reassigns it, and `EditBomHandler` never applies
`BomCompositionFactory`'s resolved `standardBomId` back onto the aggregate. A scalar-only edit
(order number, tracking number, description) never touches `BomCompositionFactory` at all, so
`standardBomMiCode` is simply omitted on that path.

## Registering vs. editing composition: no "create vs. reuse" branch

Same as `standard-boms`: nothing here ever creates a `Component`/`Material` master row, so
registering and editing a daily BOM's composition validate and clone `(componentId, materialId,
weight)` triples identically — `BomComponentInput`/`BomMaterialInput`
(`application/commands/bom-component.input.ts`) are the one shape both `RegisterBomCommand` and
`EditBomCommand` use. `PATCH` replaces the whole composition wholesale when `components` is given,
mirroring `StandardBom.updateComponents()`.

## Order number, tracking number, and weight validation

`OrderNumber`/`TrackingNumber` are required, non-empty value objects (own copies, not shared with
`standard-boms`, mirroring how each module in this clone chain owns its composition value objects
independently). Emptiness is enforced by the value objects themselves at the domain layer (a plain
`Error`, per `src/framework/CLAUDE.md`'s note on `ValueObject`); required-and-non-zero weight
validation for materials is enforced the same way. None of the three are custom `ApplicationException`
subclasses — the HTTP boundary (the next dispatch) is what turns an empty/missing value into an
ordinary 400 validation error via `class-validator`, the same way `standard-boms` handles
`ComponentName`/`MaterialName` emptiness on a product edit (see `products/CLAUDE.md`'s "name-empty"
note) — before a value object is ever constructed from untrusted input.

## Reporting ("مشاهده آنالیز روزانه"): denormalized fields, cloned once at registration

`Bom.register()` fixes five extra fields onto the aggregate at registration, alongside
`standardBomId`: `standardBomMiCode`, `brand`, `productName`, `standardLength` (all four cloned from
the `StandardBomReadModel` `BomCompositionFactory` already fetches via `GetStandardBomByMiCodeQuery`
— that read model has carried `productName` since `standard-boms` cloned it from `products` in turn,
so no extra cross-module round trip is needed) and `registeredBy` (the acting user's display name,
resolved by `BomController.register()` itself, not the handler — see below). All five are immutable
afterwards: `Bom.edit()`/`updateComponents()` never touch them, mirroring how `standardBomId` itself
is fixed at registration. This is the same clone-not-reference reasoning as the rest of this module,
one purpose further: it lets the reporting queries below read a filterable, sortable row per BOM
without a live join back into `standard-boms` (or, transitively, `products`) on every read.

`registeredBy` is resolved through `DisplayNameProvider` (`@framework/domain`), a port mirroring
`UserRoleProvider`'s own "abstract port in framework, feature module supplies the binding" shape —
`identity` provides `IdentityDisplayNameProvider`, exported from its already-`@Global()` module the
same way `UserRoleProvider` is. `BomController.register()` calls it directly with the
`@CurrentUser()` id and passes the resolved name into `RegisterBomCommand`, rather than resolving it
inside `RegisterBomHandler` — this module has no other reason to reach into `identity`, and a port
call from infrastructure is exactly what `RolesGuard` (also infrastructure) already does with
`UserRoleProvider`. A cloned name, not a reference: a user's later rename never rewrites who a report
says registered an already-existing BOM.

## The reporting queries bypass `BomRepository` and the aggregate entirely

`ReportBomsHandler` (`POST /boms/report`), `BomFilterOptionsHandler`
(`GET /boms/report/filter-options`) and `GetBomHandler` (`GET /boms/:id`) are the first genuinely
paginated/filtered/projected reads in this codebase, and none of them go through
`BomRepository.list()`/`.get()` or `Bom.fromPersistence()`. `ListBomsHandler`'s "load every aggregate,
then map" shape is fine for a small, unpaginated admin list; it stops being fine once a report needs
`WHERE`/`ORDER BY`/`LIMIT`/`OFFSET` pushed into the database rather than sliced in JS after loading
everything. All three instead go through `BomReportRepository` (`application/service/`), a read-model
repository port in the sense `handbook:oop-guideline`'s "Read Models and Layers" section means — its
implementation, `PrismaBomReportRepository` (`infrastructure/persistence/bom-report.repository.ts`),
queries `prisma.bom`/`prisma.bomComponent` directly for a projected shape and never touches
`BomMapper`.

A filter field **absent** from `BomReportFilters` means unfiltered; present as `[]` means match
nothing — this is exactly reporting-bom.feature's "انتخاب دوباره همه مقادیر"/"عدم انتخاب هیچ مقداری"
distinction. `PrismaBomReportRepository.search()` preserves it for free: a `where` clause is only
added when a filter key is present at all, and Prisma's own `{ in: [] }` already matches nothing, so
there is no special-case branching for the empty-array case. `ReportBomsDto`/`BomReportFiltersDto`
(`infrastructure/http/controllers/bom/dto/report-boms.dto.ts`) preserve the same distinction up at
the HTTP boundary: every filter field is `@IsOptional()` with no default value, so `transform: true`
in the global `ValidationPipe` never coerces a missing key into `[]` or vice versa.

`componentNames` is the one filter that reaches across the `bom`/`bom_component` join
(`components: { some: { name: { in: [...] } } }`); every other filter — `brands`,
`standardBomMiCodes`, `productNames`, `registeredByUsers`, and the `registeredAtFrom`/`registeredAtTo`
range against `createdAt` — is a plain column filter on `bom` itself. Sort is fixed
(`registeredAt` — i.e. `createdAt` — descending) with no sort parameter, matching the feature's own
single ordering rule.

`GET /boms/:id` (`GetBomHandler`) also goes through `BomReportRepository.findDetailById()` rather
than `BomRepository.get()`, for the same reason `registeredAt` (`createdAt`) needs to appear in its
response: `createdAt` is Prisma-managed and was never part of the `Bom` aggregate to begin with (see
`BomMapper`'s own comment), so a detail view built from the aggregate would need a second, separate
read just for that one field. Reading directly gets it in the same query. `totalWeight` is computed
in `GetBomHandler`, not stored — the sum of every material's weight across every component.

All three reporting endpoints are `@UseGuards(JwtAuthGuard)` only, with **no** `@Roles()` — unlike
every write endpoint on this controller, which requires QC Inspector, Management or System Admin.
This list has no role restriction on purpose: "گزارشگیر" (Reporter), the one role excluded from every
write endpoint, is exactly who this report exists for.

## The dashboard ("داشبورد بررسی روزانه آنالیز های روزانه") is a read-only sidecar

`ListDashboardProductsHandler` and `GetProductDailyBomsHandler` (the two `application/queries/`
handlers that drive the daily-BOM dashboard) are the second pair of genuinely projected,
filtered reads in this module, mirroring the reporting queries above. They go through their own
port, `BomDashboardRepository` (`application/service/bom-dashboard.repository.ts`), not through
`BomReportRepository` or the write-side `BomRepository` — for the same reason the reporting port
earned its own: the dashboard needs a *grouped* shape (per-product daily-BOM counts) and a
*flat, score-sorted* shape (per-product daily-BOM detail rows joined to a standard BOM's current
weights) that no existing port returns, and pushing them into SQL keeps the handlers free of any
in-memory slicing or per-row lookups.

`ListDashboardProductsHandler` is a 1:1 mapping: the repository already returns
`ProductDashboardSummaryRecord`s in productName-asc order (the only order the dashboard
supports), and the handler has nothing to add. The result includes only products that have at
least one daily BOM in the queried `from`/`to` range, exactly the way
`PrismaBomReportRepository.search()` does for the "match nothing vs unfiltered" distinction on
arrays — except for date bounds, which use the same inclusive-on-both-ends convention
`registeredAtFrom`/`registeredAtTo` already uses for the reporting port (absent means
unfiltered; both are added only when present).

`GetProductDailyBomsHandler` is where the dashboard crosses into `standard-boms` for the score:
it dispatches one `GetStandardBomDetailQuery(standardBomMiCode)` per distinct MI code in the
product's daily BOMs (memoising the per-MI-code standard-weights map across daily BOMs that
share one), then joins each daily BOM's material line to the standard BOM's
`(componentId, materialId)` weight to compute `score = Σ |actualWeight - standardWeight|`. A
material line on a daily BOM that no longer exists on the standard BOM's current composition
(the standard BOM was edited after the daily BOM was registered) is scored against
`standardWeight: 0` rather than skipped — the whole reason this dashboard exists is to surface
exactly those drifts, and dropping the line would silently understate the score. The join
follows `(componentId, materialId)`, the same pair `BomCompositionFactory` looks up at
registration time, so the standard-BOM read uses the very same shape that this module's own
write path already produces. The result is sorted by score desc.

The dependency-cruiser rule `bom-dashboard-handler-reuse-is-narrow` pins
`GetProductDailyBomsHandler` to importing exactly `GetStandardBomDetailQuery` and the
`StandardBomDetail` read model it returns — the read-side mirror of
`bom-composition-factory-reuse-is-narrow`, kept as a separate rule so neither carve-out widens
the other's reach.
