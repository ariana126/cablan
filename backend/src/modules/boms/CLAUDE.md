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
