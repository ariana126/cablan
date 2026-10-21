# Products (`src/modules/products/`)

Raw materials, components and products: the definitions a bill of materials is built from. A
material and a component are each a standalone, named record. A product is a name plus a
composition of components, each carrying its own materials. Follows the vertical-slice layout
described in `backend/CLAUDE.md`'s "Architecture" section.

## One module, three concepts

`materials` and `components` were modules of their own until ADR 0009
(`docs/adrs/0009-module-structure.md`) merged them into this one, so that the strongest coupling in
the definitions — a product is only valid if its components and materials exist — sits inside one
boundary. The tree stays flat and layered: one `domain/`, one `application/` and one
`infrastructure/`. Each concept is recognisable by its own folders and file prefixes inside each
layer:
- `material.aggregate.ts` / `component.aggregate.ts` / `product.aggregate.ts`
- `commands/register-material/` / `commands/register-component/` / `commands/register-product/`
- `controllers/material/` / `controllers/component/` / `controllers/product/`

A new file for one concept follows the same prefixing, rather than going into a per-concept
sub-directory.

What the merge deliberately left alone, because a client or a stored row can observe it:
- the routes `/materials`, `/components` and `/products`, and their Swagger tags;
- every controller and DTO class name, since they are OpenAPI operationIds and schema names;
- the problem types;
- the tables;
- the domain events;
- the audit `recordType` values `'Material'` and `'Component'`.

`infrastructure/http/controllers/index.ts` lists the controllers as materials, components,
products. That order is load-bearing: it is the order their routes and DTO schemas appear in
`docs/openapi.json`, the same order they had as three modules.

## Materials and components

- **Names are unique**, compared exactly and case-sensitively, so "Steel Rod" and "steel rod" are
  two materials. Registering or renaming onto a taken name throws `MaterialNameAlreadyExists`/
  `ComponentNameAlreadyExists`, a 409 carrying `name`. The `name` columns are `@unique` as a
  backstop.
- **A material's code is required and unique** (`MaterialCode`), like its name. It is trimmed
  (the DTOs trim too, so a whitespace-only code is a 400 validation error on `code`) and compared
  exactly. Registering a taken code, or editing a material onto another material's code, throws
  `MaterialCodeAlreadyExists`, a 409 carrying `code`; keeping a material's own code is fine. The
  handlers check through `MaterialRepository.findByCode`; the `code` column is `@unique` as a
  backstop, and `PrismaMaterialRepository.save()` translates that index's P2002 into the same
  exception, so a race past the pre-check is still a 409, not a 500 (pinned by
  `test/integration/material-code-uniqueness.int-spec.ts`). Under the `PrismaPg` driver adapter
  P2002 names its columns at `meta.driverAdapterError.cause.constraint.fields`, not `meta.target`.
  A `PATCH /materials/:id` must send both `name` and `code`.
- **Deletes are hard deletes.** `MaterialRepository.delete`/`ComponentRepository.delete` remove the
  row outright; nothing is kept behind a flag.
- **Deleting a material or component that a product uses is still allowed.** A product keeps the id
  and name it copied when it was composed (ADR 0004), so a later rename or delete of the material or
  component leaves it unchanged. Blocking such a delete no longer needs to cross a module boundary
  (ADR 0009), but it is a separate, specified change and has not been made.

## Composition resolves inside this module

A component or material name used in a product's composition must already be registered.
Registering or editing a product never creates a new `Component`/`Material`.
`ProductCompositionFactory` (`application/service/product-composition.factory.ts`) enforces this:
- For each component name it calls `ComponentRepository.findByName`, and for each material name
  `MaterialRepository.findByName`.
- A match's id is reused, whether it was registered for this product or an earlier, unrelated one
  (see below).
- A miss rejects the whole registration or edit with `ComponentNotRegistered`/
  `MaterialNotRegistered`, before any part of the request is persisted.

The resulting ids, and the already-validated names, are what get linked into
`ProductComponentLine`/`ProductMaterialLine`.

Because materials, components and products are one module, the factory reads the two repositories
directly. Until the merge, this lookup crossed a module boundary: it went through the `QueryBus`
by-name queries under its own dependency-cruiser carve-out. The queries and the carve-out are both
gone, and this module no longer reaches into any other.

Real-world raw-material/component vocabulary — "Copper", "Core", "Jacket" — is exactly the kind of
thing multiple products legitimately share rather than reinvent, so this by-name resolution is
global: it is not scoped to the product being registered/edited, nor to the current request. It is,
however, an *exact*-name match only — see "still resolves materials that only share a name with a
material of a different casing" in `product-composition.factory.spec.ts`.

## The read-side crossing from `manufacturing-instructions`

`manufacturing-instructions` clones a product's *current* composition when registering or editing
a manufacturing instruction, rather than referencing it live (see
`src/modules/manufacturing-instructions/CLAUDE.md` for why). It reads that composition through
`GetProductQuery`/`GetProductHandler` (`application/queries/get-product/`), dispatched on the
`QueryBus` and never through a direct call into this module's repository. The query returns the
same `ProductReadModel` that `ListProductsHandler` already builds
(`{ id, name, components: [{ id, name, materials: [{ id, name }] }] }`).

`.dependency-cruiser.cjs`'s `manufacturing-instruction-composition-factory-reuse-is-narrow` rule
pins `manufacturing-instructions`' own factory to importing exactly `get-product.query.ts` and
`product.read-model.ts` from this module, and nothing else. The only other code that knows this
module's shape is `audit-logging`'s event handlers, and they may import only `domain/events/*.ts`.

## Exceptions this module's HTTP layer has to translate

`infrastructure/http/exception.mapper.ts` (`ProductsExceptionMapper`) maps all eight of this
module's exceptions. Their Problem Details are pinned by `exception.mapper.spec.ts` next to it.

- `MaterialNameAlreadyExists` / `ComponentNameAlreadyExists` — thrown when registering or renaming
  a material/component onto a name that is already taken. Both map to `409 Conflict`, with the name
  as `name`: the request conflicts with existing state.
- `MaterialCodeAlreadyExists` — the same for a material's code: `409 Conflict`, with the code as
  `code`. The two material 409s share one `oneOf` conflict response in the OpenAPI spec.
- `ProductMustHaveAtLeastOneComponent` / `ProductComponentMustHaveAtLeastOneMaterial` — the
  product's own invariants, checked by `assertCompositionInvariants` *before* any name resolution
  happens. Both map to `400 Bad Request`: they're a defect in the request's own content, not a
  conflict with existing state.
- `ComponentNotRegistered` / `MaterialNotRegistered` — thrown by
  `ProductCompositionFactory.resolveComponentId`/`resolveMaterialId` when a component/material name
  given in the request isn't registered. Both map to `400 Bad Request` for the same reason as the
  pair above: the request references something that doesn't exist, rather than conflicting with
  something that does.
- `ProductCompositionEntryNotFound` — see "Editing a product's composition" below. `400 Bad
  Request`.
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
every entry. These are `EditProductComponentInput`/`EditProductMaterialInput` in
`application/commands/product-component.input.ts`. They are distinct from the id-less
`RegisterProductComponentInput`/`RegisterProductMaterialInput` that registration
(`POST /products`) still uses, because registration never has an existing composition to reconcile
against.

The branch happens per entry in `ProductCompositionFactory.reconcileComponentLines`. That method
is edit-only and sits alongside `createComponentLines`, which registration uses unchanged.

- **No `id`** — resolved by name exactly like registration, through
  `ComponentRepository.findByName`/`MaterialRepository.findByName`. It is rejected with
  `ComponentNotRegistered`/`MaterialNotRegistered` if the name isn't registered.
- **An `id`** — must match an entry already in *this* product's current composition: the component
  by its own id, and a material by id **within that specific component's** current materials.
  Otherwise the whole edit is rejected with `ProductCompositionEntryNotFound` (400) before any name
  resolution happens. When it matches, the existing line is reused verbatim, with no name
  resolution at all, so its own name cannot raise `ComponentNotRegistered`/`MaterialNotRegistered`.

This is what makes "resend an unchanged component to keep it" and "add one more material to an
existing component" both work: an unchanged entry is never re-resolved by name in the first place.

**Renaming a component/material through a product edit is out of scope.** A reused (`id`-carrying)
entry keeps its recorded name whatever the request's `name` field says.
`EditProductComponentDto`/`EditProductMaterialDto` still require that field, so the payload stays
consistent whether an entry is new or reused, but it is ignored once an `id` resolves. No scenario
needs to rename a material or component through a product edit. If one arises, it is a deliberate
new capability, not a bug fix to this behaviour.

## Persistence

All five tables live in `prisma/schema/products.prisma`: `material`, `component`, `product`,
`product_component` and `product_material`. A product's composition is owned data, not a
reference. `product_component` and `product_material` are child tables of `product`. They store a
copy of the `componentId`/`name` and `materialId`/`name` that `ProductCompositionFactory`
resolved, not a foreign key into `component`/`material`. Those rows outlive the product that once
composed them (see `Product.delete()`'s doc comment). A product only ever remembers their id and
name, mirroring how `ProductComponentLine`/`ProductMaterialLine` model it in the domain layer.

`PrismaComponentRepository`/`PrismaMaterialRepository` pass `tx.component`/`tx.material`
directly as their `ModelDelegate`, but `PrismaProductRepository` cannot pass `tx.product`:
- A product's aggregate spans three tables, so its delegate is a small hand-written adapter. It
  loads and saves the nested shape (`ProductRecord`) that `ProductMapper` expects.
- `Product.updateComponents()`'s doc comment says the previous composition is discarded in full,
  not merged. The delegate's `upsert` mirrors that literally: it deletes the product's existing
  `product_component` rows, which cascades to `product_material`, before recreating the
  composition the aggregate now holds.

That delete-and-recreate opens no transaction of its own: the delegate is built per call from
`txHost.tx`, so it runs inside the transaction `PrismaEntityRepository.save()` opened, and commits
or rolls back together with the product's event subscribers (ADR 0007).
