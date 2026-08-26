# Standard BOMs (`src/modules/standard-boms/`)

A Standard BOM ("آنالیز استاندارد") registers a fixed, versioned bill of materials for an existing
product: an MI code, a brand, a standard length (cable footage per drum), an active flag, an
optional description, and a composition of components/materials cloned from that product at the
moment of registration. Follows the same vertical-slice layout as `products/`,
`components/`, `materials/` — see `backend/CLAUDE.md`'s "Architecture" section for the general
shape.

## The one interesting design decision: cloning, not referencing

Registering (or editing) a Standard BOM takes a `productId` and a list of
`(componentId, materialId, weight)` triples the caller wants included. Unlike `products`, which
*creates* a brand-new `Component`/`Material` master row for every composition entry, this module
never creates one: every `componentId`/`materialId` here must already exist in the referenced
product's **current** composition, and `StandardBomCompositionFactory`
(`application/service/standard-bom-composition.factory.ts`) looks each one up and clones its id and
name — plus the caller-supplied `weight` — into the Standard BOM's own owned
`StandardBomComponentLine`/`StandardBomMaterialLine` value objects.

This is a real copy, not a live reference. Once built, those value objects hold no link back to the
product: a later change to the product's own composition (a new component added, a material
renamed) never retroactively changes an already-registered Standard BOM. There is no scenario in
`registring-standard-bom.feature` that asserts this directly — it's a backend-only design
constraint — but it's the reason the composition is cloned at all rather than stored as a foreign
key into `products`' own tables.

## The read-side crossing into `products`

`StandardBomCompositionFactory` reads a product's current composition through `GetProductQuery`
(`products/application/queries/get-product/`), dispatched on the `QueryBus` — never a direct call
into `products`' repository or domain layer. This is the read-side mirror of `products`' own
write-side crossing into `components`/`materials` (`ProductCompositionFactory`, dispatching
`Register*Command` through the `CommandBus` — see `products/CLAUDE.md`).

`.dependency-cruiser.cjs`'s `modules-isolated` rule forbids a module from importing another
module's code — this module's documented exception is carved out narrowly by
`standard-bom-composition-factory-reuse-is-narrow`, which pins `StandardBomCompositionFactory` to
importing exactly `GetProductQuery` and the `ProductReadModel` type it returns, and nothing else
from `products`.

A `productId` that doesn't resolve to an existing product surfaces as `products`'
`EntityNotFound` from `GetProductQuery` — a framework-generic 404 from `products`' own point of
view. `StandardBomCompositionFactory` catches that specific case and re-throws
`StandardBomProductNotFound`, a 400 from *this* module's point of view: the request body's own
`productId` is what's wrong, not a resource this request tried to reach directly. A `componentId`/
`materialId` pair that doesn't exist in the product's current composition is rejected the same way,
as `StandardBomCompositionEntryNotFound` — both checked, and both requests rejected, before a
Standard BOM is created or an existing one's composition is touched.

## Registering vs. editing composition: no "create vs. reuse" branch

`products`' own composition factory needs an id-optional "new vs. reused" distinction on edit,
because editing a product's composition can register brand-new `Component`/`Material` rows
alongside reused ones (see `products/CLAUDE.md`). This module has no such branch: nothing here ever
creates a `Component`/`Material` row, so registering and editing a Standard BOM's composition
validate and clone `(componentId, materialId, weight)` triples identically —
`RegisterStandardBomComponentInput`/`RegisterStandardBomMaterialInput`
(`application/commands/standard-bom-component.input.ts`) are the one shape both
`RegisterStandardBomCommand` and `EditStandardBomCommand` use.

`PATCH` replaces the whole composition wholesale when `components` is given, mirroring
`Product.updateComponents()`: there is no partial, line-by-line merge. The product a Standard BOM is
registered against cannot be changed through an edit — no scenario needs it, and it keeps a Standard
BOM's composition traceable to exactly one clone origin; `components`, when given on an edit, is
still cloned from the Standard BOM's own already-recorded `productId`.

## MI code uniqueness and the multiplicity invariants

`miCode` is required, non-empty (`MiCode.fromString`, a plain `Error` on empty — see
`src/framework/CLAUDE.md`'s note on `ValueObject`) and unique across all Standard BOMs — checked at
the application layer via `StandardBomRepository.findByMiCode`, the same pattern
`ComponentRepository.findByName` uses for `ComponentNameAlreadyExists`. On edit, the check excludes
the Standard BOM being edited itself, so resending an unchanged `miCode` is never rejected as a
duplicate of itself.

`StandardBomMustHaveAtLeastOneComponent` / `StandardBomComponentMustHaveAtLeastOneMaterial` mirror
`products`' own two composition invariants exactly, and are checked by
`assertCompositionInvariants` *before* `StandardBomCompositionFactory` dispatches a single
`GetProductQuery` — a request that would violate either one is rejected on its own content first.

## `active` has no default

`RegisterStandardBomCommand.active` is a required constructor argument with no default and no
`?`. A register request that omits it entirely must be rejected as invalid — distinctly from one
that explicitly sends `false` — which is enforced at the HTTP boundary (the next dispatch) with a
`class-validator` `@IsBoolean()` and no `@IsOptional()` on the DTO; this command's required argument
is what that boundary is obligated to supply. No edit scenario in the feature exercises `active`, so
`EditStandardBomCommand.active` stays optional (`undefined` means "leave unchanged," the same
convention `EditProductCommand.name` uses) with no comparable "must be explicit" rule.
