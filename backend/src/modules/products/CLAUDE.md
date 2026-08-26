# Products (`src/modules/products/`)

A product is a bill of materials: a name plus a composition of components, each carrying its own
materials. Follows the same vertical-slice layout as `components/` and `materials/` — see
`backend/CLAUDE.md`'s "Architecture" section for the general shape.

## The one place this module crosses another module's boundary

Registering or editing a product's composition does not select from pre-existing `Component`/
`Material` rows — every component (and every material within it) named in the request is a brand
new master row, created for the occasion. `ProductCompositionFactory`
(`application/service/product-composition.factory.ts`) is what creates them: for each component it
dispatches `RegisterComponentCommand` on the `CommandBus`, and for each material,
`RegisterMaterialCommand` — reusing `components`'/`materials`' own application layer rather than
reimplementing their name validation and uniqueness rules here. The resulting ids (and the
already-validated names) are what get linked into `ProductComponentLine`/`ProductMaterialLine`.

This is the **only** cross-module coupling in this module, and it is narrow by construction:

- It goes through the `CommandBus`, not a direct call into another module's handler or repository.
- It touches only two files per module: the `Register*Command` class (needed to construct the
  command) and the `*Name` value object (needed to validate the raw string before it's handed to
  the command — see "name-empty", below).

`.dependency-cruiser.cjs`'s `modules-isolated` rule forbids a module from importing another
module's code — this is the one documented exception, carved out narrowly by a second rule,
`product-composition-factory-reuse-is-narrow`, that pins `ProductCompositionFactory` to importing
exactly those four files and nothing else from `components`/`materials`. Any other file in this
module reaching into either of those two stays a lint failure.

## The read-side equivalent, for `standard-boms`

`standard-boms` clones a product's *current* composition when registering or editing a Standard
BOM, rather than referencing it live (see `src/modules/standard-boms/CLAUDE.md` for why). It reads
that composition through `GetProductQuery`/`GetProductHandler`
(`application/queries/get-product/`) — dispatched on the `QueryBus`, never a direct call into this
module's repository — returning the same `ProductReadModel` `ListProductsHandler` already builds
(`{ id, name, components: [{ id, name, materials: [{ id, name }] }] }`). `.dependency-cruiser.cjs`'s
`standard-bom-composition-factory-reuse-is-narrow` rule pins `standard-boms`' own factory to
importing exactly `get-product.query.ts` and `product.read-model.ts` from this module and nothing
else — the read-side mirror of `product-composition-factory-reuse-is-narrow` above.

## Exceptions this module's HTTP layer has to translate

Because `ProductCompositionFactory` reuses `components`'/`materials`' command handlers verbatim,
their application exceptions can surface through a product request too — but
`infrastructure/http/exception.mapper.ts` (`ProductsExceptionMapper`) maps only this module's own:

- `ProductMustHaveAtLeastOneComponent` / `ProductComponentMustHaveAtLeastOneMaterial` — this
  module's own invariants, checked by `assertCompositionInvariants` *before* a single
  `Register*Command` is dispatched, so a request that would violate either one never leaves an
  orphaned `Component`/`Material` row behind. Both map to `400 Bad Request`: they're a defect in
  the request's own content, not a conflict with existing state.
- `ComponentNameAlreadyExists` / `MaterialNameAlreadyExists` need **no case in this module's
  mapper**. `HttpExceptionFilter`'s chain (`src/framework/CLAUDE.md`) matches by exception type,
  not by which module's request path threw it — so `ComponentsExceptionMapper`/
  `MaterialsExceptionMapper`, already registered ahead of `ProductsExceptionMapper`, catch these
  first and map them into the exact problem-detail shape their own controllers already use.
  Duplicating that case here would be exactly the reimplementation
  `ProductCompositionFactory`'s own doc comment says this module avoids.
- **"name-empty" never reaches an exception at all.** `ComponentName.fromString`/
  `MaterialName.fromString` throw a plain `Error` on an empty name (see
  `src/framework/CLAUDE.md`'s note on `ValueObject`), which no `ExceptionMapper` matches — it would
  fall through to an unhelpful 500. This module avoids that by validating every nested component
  and material name with `class-validator` on `RegisterProductDto`/`UpdateProductDto` themselves,
  the same way a top-level `RegisterComponentDto`/`RegisterMaterialDto` does — so an empty nested
  name is rejected as an ordinary 400 validation error before `ProductCompositionFactory` ever
  builds a `ComponentName`/`MaterialName` from it.

## Editing a product's composition: reuse vs. new registration

`PATCH /products/:id`'s `components` (and each component's `materials`) accepts an optional `id` on
every entry — `EditProductComponentInput`/`EditProductMaterialInput` in
`application/commands/product-component.input.ts`, distinct from the id-less
`RegisterProductComponentInput`/`RegisterProductMaterialInput` that registration
(`POST /products`) still uses, since registration never has an existing composition to reconcile
against.

`ProductCompositionFactory.reconcileComponentLines` (edit-only, alongside the unchanged
`createComponentLines` registration uses) is where the branch happens, per entry:

- **No `id`** — registered as new, exactly like registration: a fresh `RegisterComponentCommand`/
  `RegisterMaterialCommand` dispatch.
- **An `id`** — must match an entry already in *this* product's current composition (the component
  by its own id; a material by id **within that specific component's** current materials) or the
  whole edit is rejected with `ProductCompositionEntryNotFound` (400) before any command is
  dispatched. When it matches, the existing line is reused verbatim — no new registration, so no
  collision with its own name.

This is what makes "resend an unchanged component to keep it" and "add one more material to an
existing component" both work without hitting `ComponentNameAlreadyExists`/
`MaterialNameAlreadyExists`: an unchanged entry is never re-registered in the first place.

**Renaming a component/material through a product edit is out of scope.** A reused (`id`-carrying)
entry keeps its recorded name regardless of what the request's `name` field says — that field is
still required by `EditProductComponentDto`/`EditProductMaterialDto` (so the payload stays
consistent whether an entry is new or reused) but is simply ignored once an `id` resolves. No
scenario needs renaming a master row through a product edit; if one arises, it is a deliberate new
capability, not a bug fix to this behaviour.

## Persistence

A product's composition is owned data, not a reference: `product_component` and `product_material`
are child tables of `product` (see `prisma/schema/products.prisma`), storing a copy of the
`componentId`/`name` and `materialId`/`name` `ProductCompositionFactory` produced — not a foreign
key into `component`/`material`. Those master rows belong to their own modules and outlive the
product that once composed them (see `Product.delete()`'s doc comment); a product only ever
remembers their id and name, mirroring how `ProductComponentLine`/`ProductMaterialLine` model it in
the domain layer.

`PrismaProductRepository` cannot pass `prisma.product` directly as its `ModelDelegate`, unlike
`PrismaComponentRepository`/`PrismaMaterialRepository`: a product's aggregate spans three tables, so
the delegate is a small hand-written adapter that loads/saves the nested shape (`ProductRecord`)
`ProductMapper` expects. `Product.updateComponents()`'s doc comment says the previous composition is
discarded in full, not merged — the delegate's `upsert` mirrors that literally, deleting a product's
existing `product_component` rows (which cascades to `product_material`) before recreating the
composition the aggregate now holds.
