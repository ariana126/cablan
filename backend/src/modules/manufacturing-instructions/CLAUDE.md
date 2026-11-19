# Manufacturing Instructions (`src/modules/manufacturing-instructions/`)

A Standard BOM ("آنالیز استاندارد") registers a fixed bill of materials for an existing product: an
MI code, a brand, a standard length (cable footage per drum), an active flag, an optional
description, and a composition of components/materials cloned from that product at the moment of
registration. Nothing is versioned: an edit overwrites the record in place (ADR 0009 leaves MI
revisions open). Follows the vertical-slice layout in `backend/CLAUDE.md`'s "Architecture" section.

## Names that still say "standard BOM", and why

This module was renamed from `standard-boms` (ADR 0009). Inside the backend it speaks of
Manufacturing Instructions; everything a client or a stored row can observe kept its old name,
to be renamed together with the routes when the MI feature work lands:

- The HTTP edge: `StandardBomController`, `@Controller('standard-boms')`,
  `@ApiTags('Standard BOMs')`, and every request DTO and `StandardBomExportFormat`. Their class
  names are the OpenAPI operationIds and schema names the frontend's client is generated from.
- Problem-type URIs and titles (`standard-bom-…`).
- Tables and columns (`standard_bom*`), through `@@map`/`@map` on the renamed Prisma models.
- The audit `recordType` `'StandardBom'`, stored in `audit_log_entry`.

## Endpoints

| Route | Guard | Handler |
|---|---|---|
| `POST /standard-boms` | `@Roles(SystemAdmin, Management)` | `RegisterManufacturingInstructionHandler` |
| `PATCH /standard-boms/:id` | same | `EditManufacturingInstructionHandler` |
| `DELETE /standard-boms/:id` | same | `DeleteManufacturingInstructionHandler` (hard delete) |
| `GET /standard-boms` | `@Roles(...PRODUCTION_ROLES)` (the four production roles) | `ListManufacturingInstructionsHandler` |
| `POST /standard-boms/report` | same | `ReportManufacturingInstructionsHandler` |
| `POST /standard-boms/report/export` | same | `ExportManufacturingInstructionsHandler` |
| `GET /standard-boms/report/filter-options` | same | `ManufacturingInstructionFilterOptionsHandler` |
| `GET /standard-boms/report/detail/:miCode` | same | `GetManufacturingInstructionDetailHandler` |

The read endpoints are open to all four production roles on purpose: the Reporter role
("گزارشگیر"), excluded from every write, is who the report exists for. The maintenance roles are
excluded (issue #69). The reasoning is the same as in `boms/CLAUDE.md`.

## Cloning, not referencing

Registering (or editing) a Standard BOM takes a `productId` and a list of
`(componentId, materialId, weight)` triples. Every `componentId`/`materialId` must already exist in
the referenced product's **current** composition; `ManufacturingInstructionCompositionFactory`
(`application/service/manufacturing-instruction-composition.factory.ts`) looks each one up and
clones its id and name — plus the caller's `weight` — into the Standard BOM's own
`ManufacturingInstructionComponentLine`/`ManufacturingInstructionMaterialLine` value objects, along
with the product's name.

This is a real copy (ADR 0004). Once built, those value objects hold no link back to the product: a
later change to the product's composition never retroactively changes a registered Standard BOM.
No scenario asserts this directly — it is a backend-only design constraint — but it is why the
composition is cloned rather than stored as a foreign key into `products`' tables.

## The read-side crossing into `products`

`ManufacturingInstructionCompositionFactory` reads a product's current composition through
`GetProductQuery` (`products/application/queries/get-product/`), dispatched on the `QueryBus` —
never a direct call into `products`' repository or domain layer. `.dependency-cruiser.cjs`'s
`manufacturing-instruction-composition-factory-reuse-is-narrow` pins the factory to importing
exactly `GetProductQuery` and the `ProductReadModel` it returns.

A `productId` that doesn't resolve surfaces as `products`' `EntityNotFound` (a 404 from `products`'
point of view); the factory catches it and re-throws `ManufacturingInstructionProductNotFound`, a
400 from *this* module's — the request body's own `productId` is what's wrong. A
`componentId`/`materialId` pair missing from the product's current composition is
`ManufacturingInstructionCompositionEntryNotFound`, also 400. Both are checked before anything is
created or touched.

## Registering vs. editing composition: one shape

Nothing here ever creates a `Component`/`Material` row — and neither does `products` any more,
whose composition resolves only already-registered names. So registering and editing validate and
clone triples identically: `RegisterManufacturingInstructionComponentInput`/
`RegisterManufacturingInstructionMaterialInput`
(`application/commands/manufacturing-instruction-component.input.ts`) are the one shape both
commands use. There is no id-carrying "reuse this line" branch like `products`' edit has.

`PATCH` replaces the whole composition when `components` is given, mirroring
`Product.updateComponents()`. The product cannot be changed through an edit — it keeps a Standard
BOM traceable to one clone origin — so `components` on an edit is cloned from the already-recorded
`productId`.

## MI code uniqueness and the multiplicity invariants

`miCode` is required, non-empty (`MiCode.fromString`, a plain `Error` on empty — the DTO rejects
it first) and unique. `ManufacturingInstructionRepository.findByMiCode` is the check: a taken code
is `ManufacturingInstructionMiCodeAlreadyExists`, a 409 `standard-bom-mi-code-already-exists`
carrying `miCode`. On edit the check excludes the record itself, so resending its own code is fine.
`mi_code` is `@unique` as a backstop, but unlike `products`' material codes the repository does not
translate its P2002, so a race past the pre-check is a 500.

**Digits are normalised.** `MiCode.fromString` and `Brand.fromString` apply `toAsciiDigits`
(`@framework/domain`): Persian/Arabic-Indic digits are stored as English ones, so «۱۲۳۴» is a
duplicate of «1234» (the 409 above), and both by-MI-code queries — which build an `MiCode` from
their plain string — find standard BOM «0001» from «۰۰۰۱». Case-sensitivity is unchanged.

**Trap: an MI code the `normalise_persian_digits` migration skipped.** That migration rewrote
stored brands, product names and composition names unconditionally, but an MI code only where its
English form collided with no other standard BOM's; a colliding one kept its Persian digits and was
named in a `NOTICE`. Because lookups normalise, such a row can't be found by its stored code — a
lookup for it lands on the *other* standard BOM, the one that already has the English code — and
saving it would hit the unique index (a 500). It needs resolving by hand.

**A standard BOM a daily BOM or an order references is locked (issue #94).** It can be neither
edited (any field: weights, MI code, brand, active flag …) nor deleted — 409
`record-has-dependents`, kinds `order`/`daily-bom` — except for the System Admin's correction
below. Delete stays refused for everyone. `DeleteManufacturingInstructionHandler` calls
`assertNoDependents()` right after loading it; `EditManufacturingInstructionHandler` goes through
`RecordDependencies.editRecordInUse()` inside a `UnitOfWork`.

**The System Admin may correct a standard BOM in use (issue #126)**, design
`docs/superpowers/specs/2026-11-19-system-admin-standard-bom-correction-design.md`: its standard
weights, brand, standard length, description and active flag — never its MI code (compared after
digit normalisation) or which materials each component holds. No confirmation and no
`applyToRelatedRecords`: `StandardBomController.update()` looks the caller's **current** role up
through `UserRoleProvider` and passes it as `EditManufacturingInstructionCommand.editorRole`; the
handler turns it into `ApplyToRelatedRecords.askedBy(editorRole, true)`, so only `SystemAdmin` is
granted. `ManufacturingInstruction.changesOnlyCorrectableFields(miCode, entries?)` is the
aggregate's answer: the same MI code and, when `components` is sent, the same multiset of
`(componentId, materialId)` pairs in any order (weights free). Anything else — a material added,
removed or moved, a component dropped, another MI code — is the ordinary 409 with the same
`dependents`, for the System Admin too, and nothing is written. Management is held to the rule as
before. A correction sending its components in another order stores that order (the edit replaces
the composition wholesale, as always).

The corrected `brand`/`standardLength` reach `CorrectableFields` (`name` is the MI code), so
`boms`' `PrismaBomsCorrectionPropagator` rewrites its daily BOMs' snapshots in the edit's
transaction (see `boms/CLAUDE.md`). Weights need no propagation — every comparison reads the
standard BOM's current weights through `GetManufacturingInstructionDetailQuery`. Orders hold only
MI codes, which cannot change here. The audit record is the ordinary `ManufacturingInstructionEdited`
entry: a weight-only composition change reads as `materialWeight:<component>:<material>` lines
(`100` → `105`), as a daily BOM's does (`audit-logging/CLAUDE.md`). Registering a daily BOM never
checks `active`, so a deactivated standard BOM still takes new daily BOMs.
`PrismaManufacturingInstructionsDependentsProbe`
(`infrastructure/persistence/manufacturing-instructions-dependents.probe.ts`) answers for the
references this module holds: composition lines → Material, Component, and `product_id` →
Product, each standard BOM named by its MI code. See `src/framework/CLAUDE.md`.

**A System Admin's correction rewrites the snapshots (issue #110).** When a product, component or
material in use is corrected with `applyToRelatedRecords`,
`PrismaManufacturingInstructionsCorrectionPropagator`
(`infrastructure/persistence/manufacturing-instructions-correction.propagator.ts`) rewrites, in the
correction's transaction, `standard_bom.product_name` (by `product_id`) and the composition's
`standard_bom_component.name`/`standard_bom_material.name` (by `component_id`/`material_id`) —
nothing else: weights, MI codes and the active flag stay. No event and no audit entry of a standard
BOM's. **The product name goes through raw SQL** (`$executeRaw`), because `standard_bom.updated_at`
is `@updatedAt` and a Prisma `updateMany` would bump it: a correction is not an edit of the
standard BOM.

**The MI code is editable, and daily BOMs keep the old one.** `boms` clones the code at
registration and looks the Standard BOM up by it again later — see `boms/CLAUDE.md` for what a
rename breaks there.

`ManufacturingInstructionMustHaveAtLeastOneComponent`/`…ComponentMustHaveAtLeastOneMaterial`
mirror `products`' own two composition invariants and are checked by `assertCompositionInvariants`
*before* a single `GetProductQuery` is dispatched.

## `active` has no default

`RegisterManufacturingInstructionCommand.active` is a required argument with no default. A
register request that omits it must be rejected — distinctly from one that sends `false` — which
the DTO enforces with `@IsBoolean()` and no `@IsOptional()`. `EditManufacturingInstructionCommand.active`
stays optional (`undefined` means "leave unchanged", like every edit field here).

## Queries `boms` reads through the `QueryBus`

Two of this module's queries exist mostly for `boms`, each pinned by its own dependency-cruiser
carve-out on the `boms` side:

- `GetManufacturingInstructionByMiCodeQuery` → `ManufacturingInstructionReadModel` — what
  `BomCompositionFactory` clones a daily BOM's composition from.
- `GetManufacturingInstructionDetailQuery` → `ManufacturingInstructionDetail` (components with
  weights, plus `totalWeight`) — the dashboard's standard weights. It also serves
  `GET /standard-boms/report/detail/:miCode`.

Both are keyed by the business MI code as a plain string — `boms` may not import `MiCode` — and
both throw `EntityNotFound` with the MI code as its `entityId` when nothing matches. Changing
either read model changes `boms`.

## Reporting

`POST /standard-boms/report`, its filter options and the export go through
`ManufacturingInstructionReportRepository` (`application/service/`), a read-model port implemented
by `PrismaManufacturingInstructionReportRepository`, which queries `standard_bom*` directly for a
projected shape and never loads an aggregate — the same reason `boms` has its own report port.

- `page` is **1-based** (`@IsPositive()`; `skip = (page - 1) * pageSize`).
- Filters `brands`, `activeStatuses`, `productNames`, `componentNames`, `miCodes` follow the
  reporting rule: absent is unfiltered, `[]` matches nothing. `activeStatuses` can't use Prisma's
  `in` on a boolean, so it is special-cased: `[]` matches nothing, one value is an equality, both
  values add no condition.
- Sort is `miCode` ascending by default; `sortBy: 'productName'` sorts by product name then MI
  code, both in `sortDir`.
- The port also declares `findDetailById`, which no handler calls.

The query class's own doc comments ("zero-based", "empty array means no filter") are stale; the
repository is the behaviour.

## Composition order is stored, not implied

A standard BOM's components, and each component's materials, are in the order the caller sent
them. `standard_bom_component` and `standard_bom_material` record it as `position` (0-based, per
parent), written from the array index by `toNestedCreate` in
`manufacturing-instruction.repository.ts`, and **every read that includes the composition orders by
it** — the aggregate's load (`COMPOSITION_INCLUDE`) and the export (`ORDERED_COMPOSITION` in
`manufacturing-instruction-report.repository.ts`). Prisma guarantees no order for an `include`
without an `orderBy`, so a new read of the composition must add one. On the wire the order is plain
array order. The migration that introduced `position` backfilled existing rows from physical
insertion order (`ctid`).

**A product's reordering is carried in (issue #122).** When a product's components are reordered
(see `products/CLAUDE.md`), `PrismaManufacturingInstructionsCompositionOrderPropagator`
(`infrastructure/persistence/manufacturing-instructions-composition-order.propagator.ts`), a
`CompositionOrderPropagator`, rewrites in the edit's transaction the `standard_bom_component.position`
of every standard BOM of that product, matched by `component_id`; a line whose component the product
no longer has keeps its relative place after the others. Only the rows that move are updated;
materials, weights, the MI code, the active flag and `standard_bom.updated_at` stay. No event and no
audit entry of a standard BOM's. This is the one way a standard BOM's order changes other than its
own edit.

## The Excel export is rendered here, not by the client

`POST /standard-boms/report/export` answers with the `.xlsx` file itself, mirroring `boms`' export:
the handler returns `ManufacturingInstructionExportResult`, and `StandardBomController.export()`
shapes it with `buildManufacturingInstructionExportGrid`
(`infrastructure/spreadsheet/standard-bom-export-grid.ts`) and renders it with the framework's
spreadsheet helpers. The request takes `format` (`perMaterial` | `perBom`) and no time zone —
nothing in this export is a point in time. `active` is written بله/خیر, a missing description `-`,
and the file is named `گزارش-آنالیز-های-استاندارد.xlsx`.
