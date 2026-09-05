# Products (`src/modules/products/`)

A product is a bill of materials: a name plus a composition of components, each carrying its own
materials. Follows the same vertical-slice layout as `components/` and `materials/` — see
`backend/CLAUDE.md`'s "Architecture" section for the general shape.

## The one place this module crosses another module's boundary

A component or material name used in a product's composition must already be registered in the
`components`/`materials` module — registering or editing a product never creates a new `Component`/
`Material` master row. `ProductCompositionFactory` (`application/service/product-composition.factory.ts`)
is what enforces this: for each component name it dispatches `FindComponentByNameQuery` on the
`QueryBus`, and the same for each material with `FindMaterialByNameQuery`. When the query finds a
match, its id is reused (by this product or an earlier, unrelated one — see below); when it finds
nothing, the whole registration/edit is rejected outright with `ComponentNotRegistered`/
`MaterialNotRegistered`, before any part of the request is persisted. This reuses `components`'/
`materials`' own application layer for the lookup rather than reimplementing it here. The resulting
ids (and the already-validated names) are what get linked into `ProductComponentLine`/
`ProductMaterialLine`.

Real-world raw-material/component vocabulary — "Copper", "Core", "Jacket" — is exactly the kind of
thing multiple products legitimately share rather than reinvent, so this by-name resolution is
global: it is not scoped to the product being registered/edited, nor to the current request. It is,
however, an *exact*-name match only — see "still resolves materials that only share a name with a
material of a different casing" in `product-composition.factory.spec.ts`.

This is the **only** cross-module coupling in this module, and it is narrow by construction:

- It goes through the `QueryBus`, not a direct call into another module's handler or repository.
- It touches only two files per module: the `Find*ByNameQuery` class (needed to construct the
  query) and the `*Name` value object (needed to validate the raw string before it's handed to the
  query — see "name-empty", below).

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

`infrastructure/http/exception.mapper.ts` (`ProductsExceptionMapper`) maps this module's own
exceptions:

- `ProductMustHaveAtLeastOneComponent` / `ProductComponentMustHaveAtLeastOneMaterial` — this
  module's own invariants, checked by `assertCompositionInvariants` *before* any name resolution
  happens. Both map to `400 Bad Request`: they're a defect in the request's own content, not a
  conflict with existing state.
- `ComponentNotRegistered` / `MaterialNotRegistered` — thrown by
  `ProductCompositionFactory.resolveComponentId`/`resolveMaterialId` when a component/material name
  given in the request doesn't resolve to a row already registered in `components`/`materials`.
  Both map to `400 Bad Request` for the same reason as the pair above: the request references
  something that doesn't exist, rather than conflicting with something that does.
- **"name-empty" never reaches an exception at all.** `ComponentName.fromString`/
  `MaterialName.fromString` throw a plain `Error` on an empty name (see
  `src/framework/CLAUDE.md`'s note on `ValueObject`), which no `ExceptionMapper` matches — it would
  fall through to an unhelpful 500. This module avoids that by validating every nested component
  and material name with `class-validator` on `RegisterProductDto`/`UpdateProductDto` themselves,
  the same way a top-level `RegisterComponentDto`/`RegisterMaterialDto` does — so an empty nested
  name is rejected as an ordinary 400 validation error before `ProductCompositionFactory` ever
  builds a `ComponentName`/`MaterialName` from it.

## Editing a product's composition: reuse vs. by-name resolution

`PATCH /products/:id`'s `components` (and each component's `materials`) accepts an optional `id` on
every entry — `EditProductComponentInput`/`EditProductMaterialInput` in
`application/commands/product-component.input.ts`, distinct from the id-less
`RegisterProductComponentInput`/`RegisterProductMaterialInput` that registration
(`POST /products`) still uses, since registration never has an existing composition to reconcile
against.

`ProductCompositionFactory.reconcileComponentLines` (edit-only, alongside the unchanged
`createComponentLines` registration uses) is where the branch happens, per entry:

- **No `id`** — resolved by name exactly like registration: `FindComponentByNameQuery`/
  `FindMaterialByNameQuery`, rejected with `ComponentNotRegistered`/`MaterialNotRegistered` if the
  name doesn't resolve to an already-registered row.
- **An `id`** — must match an entry already in *this* product's current composition (the component
  by its own id; a material by id **within that specific component's** current materials) or the
  whole edit is rejected with `ProductCompositionEntryNotFound` (400) before any name resolution
  happens. When it matches, the existing line is reused verbatim — no name resolution at all, so no
  risk of `ComponentNotRegistered`/`MaterialNotRegistered` over its own name.

This is what makes "resend an unchanged component to keep it" and "add one more material to an
existing component" both work: an unchanged entry is never re-resolved by name in the first place.

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
