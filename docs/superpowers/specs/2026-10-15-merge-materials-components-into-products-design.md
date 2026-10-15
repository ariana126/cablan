# Design: merge `materials` and `components` into `products`

- **Date:** 2026-10-15
- **Implements:** [ADR 0009](../../adrs/0009-module-structure.md). This is the second of three
  refactorings. It comes after
  [the manufacturing-instructions rename](2026-10-15-standard-boms-to-manufacturing-instructions-design.md)
  and before the transactional audit trail
  ([ADR 0007](../../adrs/0007-transactional-audit-trail.md)).
- **Kind:** behaviour-preserving refactoring, backend only.
- **Precondition:** the rename commit has landed. Module names below assume
  `manufacturing-instructions` already exists.

## Goal

Raw materials, components and products become one backend module, `products`. A product cannot
exist without its components and materials, so the strongest coupling in the definitions moves
inside one boundary. One cross-module exception disappears.

Nothing a client, a stored row or a user can observe changes.

## 1. Layout: one flat, layered tree

`modules/products/` keeps the shape every module has: `domain/`, `application/`,
`infrastructure/`. Each file of `modules/materials/` and `modules/components/` moves with
`git mv` into the same layer folder under `modules/products/`. For example:

| From | To |
|---|---|
| `materials/domain/material.aggregate.ts` | `products/domain/material.aggregate.ts` |
| `components/domain/events/component-renamed.event.ts` | `products/domain/events/component-renamed.event.ts` |
| `materials/domain/value/material-code.vo.ts` | `products/domain/value/material-code.vo.ts` |
| `components/application/commands/register-component/` | `products/application/commands/register-component/` |
| `materials/application/queries/list-materials/` | `products/application/queries/list-materials/` |
| `materials/application/support/in-memory-material-repository.ts` | `products/application/support/in-memory-material-repository.ts` |
| `components/infrastructure/http/controllers/component/` | `products/infrastructure/http/controllers/component/` |
| `materials/infrastructure/persistence/material.{mapper,repository}.ts` | `products/infrastructure/persistence/material.{mapper,repository}.ts` |

No leaf file names collide. Each concept stays recognisable by its own folders and file prefixes
inside each layer.

**Merged, not moved:**

- **Barrels.** `application/commands/index.ts`, `application/queries/index.ts`,
  `application/exceptions/index.ts` and `infrastructure/http/controllers/index.ts` each become one
  barrel that exports all three concepts. The command and query handler arrays are concatenated.
- **Exception mapper.** `MaterialsExceptionMapper` and `ComponentsExceptionMapper` fold into
  `ProductsExceptionMapper`, which then maps all seven exceptions:
  - `MaterialNameAlreadyExists` → 409
  - `ComponentNameAlreadyExists` → 409
  - the five product cases → 400

  Every case keeps its type URI, title, status, detail and extension members.
- **Nest module.** `MaterialsModule` and `ComponentsModule` fold into `ProductsModule`. It
  provides every controller, command handler and query handler, plus `MaterialRepository`,
  `ComponentRepository`, `ProductRepository` (each bound to its Prisma implementation) and
  `ProductCompositionFactory`.
- **Prisma schema.** `materials.prisma` and `components.prisma` fold into `products.prisma`. The
  models, fields, `@map`/`@@map` values and comments stay as they are, apart from fixing the stale
  "creates master rows" comment.

**Wiring:**

- The `@materials/*` and `@components/*` aliases are removed from `backend/tsconfig.json` and from
  the Jest `moduleNameMapper` in `backend/package.json`.
- `app.module.ts` imports only `ProductsModule`, in the place `MaterialsModule` held.
- The `ExceptionMappers` array in `exception.filter.ts` lists only `ProductsExceptionMapper`.
- In audit-logging, `application/event-handlers/materials/` and `.../components/` move into
  `.../event-handlers/products/`, keeping the "one folder per source module" convention. Their
  imports change to `@products/domain/events/…`, and `event-handlers/index.ts` follows.

## 2. The one code change: composition lookup without the bus

`ProductCompositionFactory` drops its `QueryBus` dependency. Instead it injects
`ComponentRepository` and `MaterialRepository` and resolves names with their existing
`findByName(ComponentName | MaterialName)`.

The lookup behaves exactly as before:

- matching on names is exact and case-sensitive;
- a miss throws `ComponentNotRegistered.withName(...)` or `MaterialNotRegistered.withName(...)`;
- a hit uses the found aggregate's `id` and `name`, the same two fields the query handlers
  returned.

`FindMaterialByNameQuery`/`Handler` and `FindComponentByNameQuery`/`Handler`, with their specs,
had no other consumer, so they are **deleted**.

The factory spec and the `register-product` and `edit-product` handler specs replace the stub
`QueryBus` with `InMemoryMaterialRepository` and `InMemoryComponentRepository`, seeded through
their aggregates' own factories. Their assertions stay the same. If `stub-query-bus.ts` in
`products/application/support/` is left with no users, it is deleted.

## 3. What deliberately stays

| Kept | Reason |
|---|---|
| `@Controller('materials')`, `@Controller('components')`, `@Controller('products')`, and their `@ApiTags('Materials' \| 'Components' \| 'Products')` | Routes, operationIds and the generated client services |
| Every controller class and DTO class name | They are OpenAPI operationIds and schema names |
| Problem URIs and titles, such as `material-name-already-exists` and `component-name-already-exists` | API contract |
| Tables `material`, `component`, `product*` and all columns; no migration; no new foreign keys | Stored data |
| Domain events (`MaterialRegistered/Edited/Deleted`, `ComponentRegistered/Renamed/Deleted`) and the audit `recordType` values `'Material'` and `'Component'` | Stored audit data and the API enum |
| Delete behaviour: a material or component can still be deleted while a product uses it | Blocking it would change behaviour. ADR 0009 makes it *possible* inside one module; doing it is a separate, specified change |
| Rename behaviour: products keep their copied names | Unchanged by design (ADR 0004) |
| `frontend/` and `acceptance-tests/` | Out of scope |

## 4. Architecture lint (`backend/.dependency-cruiser.cjs`)

- **Delete** the rule `product-composition-factory-reuse-is-narrow`.
- **Delete** the `products/application/service/product-composition\.factory\.ts` exemption from
  the `modules-isolated` `from.pathNot`.
- **Fix** the stale `modules-isolated` comment. It claims the factory reuses
  `RegisterComponentCommand`/`RegisterMaterialCommand`, which it no longer does.
- **Shorten** the module alternation in `audit-logging-event-handlers-reuse-is-narrow` to
  `(identity|products|manufacturing-instructions|boms)`.
- **Keep** the `manufacturing-instruction-composition-factory-reuse-is-narrow` rule's target,
  `products/application/queries/(get-product/…|list-products/product.read-model.ts)`, unchanged.

After this change, products has no cross-module exception at all.

## 5. Docs

- `products/CLAUDE.md`: rewrite the "only cross-module coupling" section. Composition now
  resolves within the module through the repositories. Add a short section on materials and
  components, covering:
  - names are unique;
  - materials have an optional code;
  - deletes are hard deletes;
  - deleting a material or component that a product uses is still allowed, and products keep
    their copied names.
- Update the references in `audit-logging/CLAUDE.md`, `manufacturing-instructions/CLAUDE.md` and
  `backend/CLAUDE.md`, if they name the old modules.
- Add a note to ADR 0009 recording that the merge is done and that delete-blocking is still
  deferred.

## 6. How behaviour preservation is proven

1. **The error responses are pinned before the move.** A characterisation spec for the three
   current mappers is written and passes on the unmerged code. It asserts every case's type URI,
   title, status, detail and extension members. After the move, the same assertions run against
   `ProductsExceptionMapper`.
2. **The contract is unchanged.** `make generate-swagger` leaves `backend/docs/openapi.*`
   byte-identical, and `lint-swagger` and `lint-api-contract` pass.
3. **The database is unchanged.** No migration is added, and a schema-to-schema
   `prisma migrate diff` from the previous commit's `prisma/schema` reports an empty migration.
4. **The other projects are untouched.** There is no diff under `frontend/` or
   `acceptance-tests/`.
5. **The guardrails pass.** `make run-guardrails` is fully green. That includes:
   - unit tests;
   - `lint-architecture`, with one exception fewer;
   - the material, component, product and audit-log acceptance scenarios.
6. **No stale references remain.** `grep -rn "@materials/\|@components/\|MaterialsModule\|ComponentsModule\|MaterialsExceptionMapper\|ComponentsExceptionMapper\|FindMaterialByName\|FindComponentByName" backend/src`
   returns nothing.

## 7. Delivery

- **Who:** one `backend-engineer` dispatch on the same branch, after the rename commit. The
  orchestrator checks the proofs in section 6.
- **Commit:** one commit, `refactor(backend): merge materials and components into products`.

## Out of scope

- Blocking the deletion of materials or components that are in use.
- Adding foreign keys between product rows and material or component rows.
- Changing routes, DTOs, the frontend or the acceptance tests.
- Changing the domain model of materials, components or products.
