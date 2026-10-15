# Merge `materials` and `components` into `products`: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task by task. Steps use
> checkbox (`- [ ]`) syntax for tracking. In this repo, Tasks 1–3 are carried out by the
> `backend-engineer` sub-agent, which reads `backend/CLAUDE.md` before starting. Task 4 is run by
> the orchestrator.

**Goal:** Fold the backend modules `materials` and `components` into `products`, so that product
composition resolves material and component names inside one module. Nothing a client, a stored
row or a user can observe may change.

**Architecture:** Every file of `materials/` and `components/` moves with `git mv` into the same
layer folder under `products/`. The four barrels, the exception mapper, the Nest module and the
Prisma schema file that exist once per module are merged into the `products` copy. The
`@materials/*`/`@components/*` aliases are rewritten to `@products/*`. There is one real code
change: `ProductCompositionFactory` stops dispatching `Find*ByNameQuery` on the `QueryBus` and
calls `ComponentRepository.findByName`/`MaterialRepository.findByName` instead. The two queries
lose their only consumer and are deleted.

**Tech Stack:** NestJS 11, `@nestjs/cqrs`, Prisma 7 (client generated inside the Docker image),
Jest + ts-jest, ESLint (`simple-import-sort`), dependency-cruiser, Docker Compose. Every command
runs in a container through `make` or `docker compose … run --rm --no-deps app`.

**Spec:** `docs/superpowers/specs/2026-10-15-merge-materials-components-into-products-design.md`.
Read it before starting. Its section 3 ("What deliberately stays") overrides any instruction here
that seems to contradict it.

## Global Constraints

- **Precondition:** the rename commit has landed on `refactor/manufacturing-instructions-module`.
  `git log -1 --format=%h --grep='rename standard-boms module to manufacturing-instructions'` must
  print a commit. Below, `RENAME_COMMIT` means that command's output. Every path and name in this
  plan is written as it is **after** that rename: module `src/modules/manufacturing-instructions`,
  alias `@manufacturing-instructions/*`, `ManufacturingInstructionsModule`,
  `ManufacturingInstructionsExceptionMapper`, `ManufacturingInstructionCompositionFactory`, and the
  dependency-cruiser rule `manufacturing-instruction-composition-factory-reuse-is-narrow`.
- Only files under `backend/` and `docs/` may change. Nothing under `frontend/` or
  `acceptance-tests/` may change.
- `backend/docs/openapi.json` and `backend/docs/openapi.yaml` must be byte-identical to
  `RENAME_COMMIT`'s after `make generate-swagger`.
- No new folder under `backend/prisma/migrations/`, and no `@map`/`@@map`, field or model change.
- Kept exactly as they are (spec §3):
  - `@Controller('materials')`, `@Controller('components')`, `@Controller('products')` and
    `@ApiTags('Materials' | 'Components' | 'Products')`
  - every controller and DTO class name, and every `@ApiOperation`/`@ApiResponse` string. That
    includes the product registration summary "…already registered in components/materials". It is
    in the OpenAPI spec, so it is contract, not a stale comment.
  - every problem-type URI and title (`material-name-already-exists`,
    `component-name-already-exists`, …)
  - tables `material`, `component`, `product*`, and all their columns
  - the domain events `MaterialRegistered/Edited/Deleted` and
    `ComponentRegistered/Renamed/Deleted`, and the audit `recordType` values `'Material'` and
    `'Component'`
  - delete behaviour: a material or component can still be deleted while a product uses it
  - rename behaviour: products keep their copied names
- Use `git mv` for every move so that history follows the files.
- Final history: exactly one commit on top of `RENAME_COMMIT`, with the message
  `refactor(backend): merge materials and components into products`.

## Review Focus

These are the failure modes most likely to reach a user that no existing unit test pins down:

1. **Problem Details for the seven errors.** A duplicate material or component name must still be
   a 409 with `name`. The five product cases must still be 400s with their own extension members.
   Every case keeps its type URI, title and detail. **Pinned by** the new
   `products/infrastructure/http/exception.mapper.spec.ts` in Task 1. It is written and passes
   **before** the move, then runs against the merged `ProductsExceptionMapper`.
2. **OpenAPI route and schema order.** Swagger emits paths and DTO schemas in controller
   registration order. Today that is materials, then components, then products, because the three
   modules are imported in that order. The merged `Controllers` array must keep that order, or
   `docs/openapi.json` reorders and `lint-swagger`/`lint-api-contract` fail. **Pinned by**
   `make backend/lint-swagger` in Tasks 1 and 2, and the byte-identity check in Task 4.
3. **Audit entries for material and component changes.** If the merged audit `EventHandlers`
   array loses a handler, that event silently stops being audited. The audit-log acceptance
   scenarios seed their rows directly, so they would not notice. **Pinned by** the new
   `audit-logging/application/event-handlers/index.spec.ts` in Task 1, written before the move.
4. **Name lookup on a miss.** The repositories return `null` on a miss. The old query handlers
   returned `undefined`. If the factory checks with `=== undefined`, an unregistered name becomes
   a `TypeError` and a 500 instead of a 400. **Pinned by** the factory spec's "not already
   registered" cases in Task 2, which run against the in-memory repositories. Those return `null`,
   exactly like the Prisma ones.
5. **Dependency injection of the factory's new collaborators.** `ProductsModule` must bind
   `MaterialRepository` and `ComponentRepository`. Otherwise the app fails to boot, and
   `POST /products` can never resolve a name. Unit tests build the factory by hand, so they cannot
   see this. **Pinned by** `make backend/lint-swagger` in Task 2, which boots `AppModule` through
   `NestFactory.create`, and by the `registring-product` acceptance scenarios in Task 4.

---

### Task 1: Pin the Problem Details and the audit wiring, then move and merge the modules

**Files:**
- Create:
  - `backend/src/modules/products/infrastructure/http/exception.mapper.spec.ts`
  - `backend/src/modules/audit-logging/application/event-handlers/index.spec.ts`
- Move (64 files): every file of `backend/src/modules/materials/` and
  `backend/src/modules/components/` to the same relative path under
  `backend/src/modules/products/`, except the 12 files listed under "Merge, then delete"
- Merge, then delete (12 files): for each of `materials` and `components`:
  - `application/commands/index.ts`, `application/queries/index.ts` and
    `application/exceptions/index.ts`
  - `infrastructure/http/controllers/index.ts` and `infrastructure/http/exception.mapper.ts`
  - `infrastructure/{materials,components}.module.ts`
- Move (8 files): `backend/src/modules/audit-logging/application/event-handlers/{materials,components}/*`
  → `.../event-handlers/products/`
- Merge, then delete: `backend/prisma/schema/materials.prisma` and
  `backend/prisma/schema/components.prisma` → `backend/prisma/schema/products.prisma`
- Modify:
  - `backend/src/modules/products/application/{commands,queries,exceptions}/index.ts`
  - `backend/src/modules/products/infrastructure/http/controllers/index.ts`
  - `backend/src/modules/products/infrastructure/http/exception.mapper.ts`
  - `backend/src/modules/products/infrastructure/products.module.ts`
  - `backend/src/modules/audit-logging/application/event-handlers/index.ts`
  - `backend/tsconfig.json:21-22` and `backend/package.json:111-112`
  - `backend/src/app.module.ts`
  - `backend/src/framework/infrastructure/http/exception.filter.ts`
  - `backend/.dependency-cruiser.cjs`, in the rules `modules-isolated`,
    `product-composition-factory-reuse-is-narrow` (deleted) and
    `audit-logging-event-handlers-reuse-is-narrow`

**Interfaces:**
- Consumes: the post-rename tree (see Global Constraints).
- Produces (Task 2 relies on these exact paths and signatures):
  - `@products/domain/material.aggregate`: `Material.register(name: MaterialName, code: MaterialCode | null): Material`
  - `@products/domain/component.aggregate`: `Component.register(name: ComponentName): Component`
  - `@products/domain/value/material-name.vo`: `MaterialName.fromString(name: string)`
  - `@products/domain/value/component-name.vo`: `ComponentName.fromString(name: string)`
  - `@products/domain/service/material.repository`: abstract `MaterialRepository` with
    `findByName(name: MaterialName): Promise<Material | null>`
  - `@products/domain/service/component.repository`: abstract `ComponentRepository` with
    `findByName(name: ComponentName): Promise<Component | null>`
  - `@products/application/support/in-memory-material-repository`:
    `InMemoryMaterialRepository`, with `seed(material: Material): Material`
  - `@products/application/support/in-memory-component-repository`:
    `InMemoryComponentRepository`, with `seed(component: Component): Component`
  - `ProductsModule`, which provides `MaterialRepository`, `ComponentRepository` and
    `ProductRepository`, each bound to its Prisma class, plus `ProductCompositionFactory`
  - `@products/application/exceptions`, a barrel that exports all seven exceptions

- [ ] **Step 1: Record a green baseline**

From the repo root:

```bash
git log -1 --format='%h %s' --grep='rename standard-boms module to manufacturing-instructions'
git status --short
make backend/run-unit-tests
make backend/lint-architecture
make backend/lint-swagger
```

Expected:
- The first command prints the rename commit.
- `git status` is clean.
- All three targets exit 0.

If the rename commit is missing, stop: this plan must not run before the rename. If a target
fails, stop and report: the baseline must be green before anything moves.

- [ ] **Step 2: Write the Problem Details characterisation spec (against the three current mappers)**

Create `backend/src/modules/products/infrastructure/http/exception.mapper.spec.ts`:

```ts
import { ComponentNameAlreadyExists } from '@components/application/exceptions';
import { ComponentName } from '@components/domain/value/component-name.vo';
import { ComponentsExceptionMapper } from '@components/infrastructure/http/exception.mapper';
import { ExceptionMapper, ProblemDetail } from '@framework/infrastructure';
import { MaterialNameAlreadyExists } from '@materials/application/exceptions';
import { MaterialName } from '@materials/domain/value/material-name.vo';
import { MaterialsExceptionMapper } from '@materials/infrastructure/http/exception.mapper';
import { HttpStatus } from '@nestjs/common';
import {
  ComponentNotRegistered,
  MaterialNotRegistered,
  ProductComponentMustHaveAtLeastOneMaterial,
  ProductCompositionEntryNotFound,
  ProductMustHaveAtLeastOneComponent,
} from '@products/application/exceptions';

import { ProductsExceptionMapper } from './exception.mapper';

// Pins the public Problem Details contract of every exception that materials,
// components and products map, so that merging their mappers into one cannot
// change what a client sees. `HttpExceptionFilter` asks the mappers in turn,
// so each exception must be claimed by exactly one of them.
const mappers: ExceptionMapper[] = [
  new MaterialsExceptionMapper(),
  new ComponentsExceptionMapper(),
  new ProductsExceptionMapper(),
];

function problemFor(exception: unknown): ProblemDetail {
  const claiming = mappers.filter((mapper) => mapper.canMap(exception));
  if (claiming.length !== 1) {
    throw new Error(
      `Expected exactly one mapper to claim ${String(exception)}, got ${claiming.length}`,
    );
  }
  return claiming[0].toProblemDetail(exception);
}

describe('Problem Details for materials, components and products', () => {
  it('maps a duplicate material name to a 409 carrying the name', () => {
    const problem = problemFor(
      MaterialNameAlreadyExists.withName(MaterialName.fromString('Steel Rod')),
    );

    expect({ ...problem }).toStrictEqual({
      typeUri: 'material-name-already-exists',
      title: 'Material Name Already Exists',
      status: HttpStatus.CONFLICT,
      detail: 'A material already exists with name Steel Rod',
      instance: undefined,
      extensionMembers: { name: 'Steel Rod' },
    });
  });

  it('maps a duplicate component name to a 409 carrying the name', () => {
    const problem = problemFor(
      ComponentNameAlreadyExists.withName(ComponentName.fromString('Bolt')),
    );

    expect({ ...problem }).toStrictEqual({
      typeUri: 'component-name-already-exists',
      title: 'Component Name Already Exists',
      status: HttpStatus.CONFLICT,
      detail: 'A component already exists with name Bolt',
      instance: undefined,
      extensionMembers: { name: 'Bolt' },
    });
  });

  it('maps a product without components to a 400 with no extension members', () => {
    const problem = problemFor(ProductMustHaveAtLeastOneComponent.create());

    expect({ ...problem }).toStrictEqual({
      typeUri: 'product-must-have-at-least-one-component',
      title: 'Product Must Have At Least One Component',
      status: HttpStatus.BAD_REQUEST,
      detail: 'A product must have at least one component',
      instance: undefined,
      extensionMembers: undefined,
    });
  });

  it('maps a component without materials to a 400 carrying the component name', () => {
    const problem = problemFor(
      ProductComponentMustHaveAtLeastOneMaterial.forComponent('Bolt'),
    );

    expect({ ...problem }).toStrictEqual({
      typeUri: 'product-component-must-have-at-least-one-material',
      title: 'Product Component Must Have At Least One Material',
      status: HttpStatus.BAD_REQUEST,
      detail: 'Component Bolt must have at least one material',
      instance: undefined,
      extensionMembers: { componentName: 'Bolt' },
    });
  });

  it('maps an unknown component entry to a 400 carrying the entry id', () => {
    const problem = problemFor(
      ProductCompositionEntryNotFound.forComponent('c-1'),
    );

    expect({ ...problem }).toStrictEqual({
      typeUri: 'product-composition-entry-not-found',
      title: 'Product Composition Entry Not Found',
      status: HttpStatus.BAD_REQUEST,
      detail:
        "No component with id c-1 exists in this product's current composition",
      instance: undefined,
      extensionMembers: { entryId: 'c-1' },
    });
  });

  it('maps an unknown material entry to a 400 carrying the entry id', () => {
    const problem = problemFor(
      ProductCompositionEntryNotFound.forMaterial('m-1'),
    );

    expect({ ...problem }).toStrictEqual({
      typeUri: 'product-composition-entry-not-found',
      title: 'Product Composition Entry Not Found',
      status: HttpStatus.BAD_REQUEST,
      detail:
        "No material with id m-1 exists in this product's current composition",
      instance: undefined,
      extensionMembers: { entryId: 'm-1' },
    });
  });

  it('maps an unregistered component name to a 400 carrying the name', () => {
    const problem = problemFor(ComponentNotRegistered.withName('Bolt'));

    expect({ ...problem }).toStrictEqual({
      typeUri: 'component-not-registered',
      title: 'Component Not Registered',
      status: HttpStatus.BAD_REQUEST,
      detail: 'No component named "Bolt" is registered',
      instance: undefined,
      extensionMembers: { componentName: 'Bolt' },
    });
  });

  it('maps an unregistered material name to a 400 carrying the name', () => {
    const problem = problemFor(MaterialNotRegistered.withName('Steel Rod'));

    expect({ ...problem }).toStrictEqual({
      typeUri: 'material-not-registered',
      title: 'Material Not Registered',
      status: HttpStatus.BAD_REQUEST,
      detail: 'No material named "Steel Rod" is registered',
      instance: undefined,
      extensionMembers: { materialName: 'Steel Rod' },
    });
  });

  it('leaves an unrelated error to the other mappers', () => {
    expect(mappers.some((mapper) => mapper.canMap(new Error('other')))).toBe(
      false,
    );
  });
});
```

`{ ...problem }` copies `ProblemDetail`'s six constructor properties, including the ones that are
`undefined`. `toStrictEqual` therefore also pins that no extension members or `instance` appear.

- [ ] **Step 3: Write the audit wiring pin**

Create `backend/src/modules/audit-logging/application/event-handlers/index.spec.ts`:

```ts
import { EventHandlers } from '@audit-logging/application/event-handlers';
import { ComponentDeletedAuditHandler } from '@audit-logging/application/event-handlers/components/component-deleted.handler';
import { ComponentRegisteredAuditHandler } from '@audit-logging/application/event-handlers/components/component-registered.handler';
import { ComponentRenamedAuditHandler } from '@audit-logging/application/event-handlers/components/component-renamed.handler';
import { MaterialDeletedAuditHandler } from '@audit-logging/application/event-handlers/materials/material-deleted.handler';
import { MaterialEditedAuditHandler } from '@audit-logging/application/event-handlers/materials/material-edited.handler';
import { MaterialRegisteredAuditHandler } from '@audit-logging/application/event-handlers/materials/material-registered.handler';

// A handler missing from `EventHandlers` is never registered with Nest, so its
// event is silently not audited. Nothing else notices: each handler's own spec
// calls it directly.
describe('EventHandlers', () => {
  it('subscribes the audit trail to every material and component event', () => {
    expect(EventHandlers).toEqual(
      expect.arrayContaining([
        MaterialRegisteredAuditHandler,
        MaterialEditedAuditHandler,
        MaterialDeletedAuditHandler,
        ComponentRegisteredAuditHandler,
        ComponentRenamedAuditHandler,
        ComponentDeletedAuditHandler,
      ]),
    );
  });
});
```

- [ ] **Step 4: Run both pins against the unmerged code**

```bash
docker compose -f backend/docker-compose.yml run --rm --no-deps app \
  npx jest modules/products/infrastructure/http modules/audit-logging/application/event-handlers/index
```

Expected: PASS, with 9 + 1 tests. These are characterisation tests, so they must pass *before*
the move. If one fails, the current code differs from what the test assumes. Fix the test to match
the real current output, never the mapper, and record the difference in the task report.

- [ ] **Step 5: Move every non-merged file of `materials/` and `components/` into `products/`**

```bash
cd "$(git rev-parse --show-toplevel)/backend"
while read -r src; do
  rest=${src#*/}
  mkdir -p "src/modules/products/$(dirname "$rest")"
  git mv "src/modules/$src" "src/modules/products/$rest"
done <<'EOF'
materials/application/commands/delete-material/delete-material.command.ts
materials/application/commands/delete-material/delete-material.handler.spec.ts
materials/application/commands/delete-material/delete-material.handler.ts
materials/application/commands/edit-material/edit-material.command.ts
materials/application/commands/edit-material/edit-material.handler.spec.ts
materials/application/commands/edit-material/edit-material.handler.ts
materials/application/commands/register-material/register-material.command.ts
materials/application/commands/register-material/register-material.handler.spec.ts
materials/application/commands/register-material/register-material.handler.ts
materials/application/exceptions/material-name-already-exists.exception.ts
materials/application/queries/find-material-by-name/find-material-by-name.handler.spec.ts
materials/application/queries/find-material-by-name/find-material-by-name.handler.ts
materials/application/queries/find-material-by-name/find-material-by-name.query.ts
materials/application/queries/list-materials/list-materials.handler.spec.ts
materials/application/queries/list-materials/list-materials.handler.ts
materials/application/queries/list-materials/list-materials.query.ts
materials/application/queries/list-materials/material.read-model.ts
materials/application/support/in-memory-material-repository.ts
materials/domain/events/material-deleted.event.ts
materials/domain/events/material-edited.event.ts
materials/domain/events/material-registered.event.ts
materials/domain/material.aggregate.spec.ts
materials/domain/material.aggregate.ts
materials/domain/service/material.repository.ts
materials/domain/value/material-code.vo.spec.ts
materials/domain/value/material-code.vo.ts
materials/domain/value/material-name.vo.spec.ts
materials/domain/value/material-name.vo.ts
materials/infrastructure/http/controllers/material/dto/register-material.dto.ts
materials/infrastructure/http/controllers/material/dto/update-material.dto.ts
materials/infrastructure/http/controllers/material/material.controller.ts
materials/infrastructure/persistence/material.mapper.ts
materials/infrastructure/persistence/material.repository.ts
components/application/commands/delete-component/delete-component.command.ts
components/application/commands/delete-component/delete-component.handler.spec.ts
components/application/commands/delete-component/delete-component.handler.ts
components/application/commands/edit-component/edit-component.command.ts
components/application/commands/edit-component/edit-component.handler.spec.ts
components/application/commands/edit-component/edit-component.handler.ts
components/application/commands/register-component/register-component.command.ts
components/application/commands/register-component/register-component.handler.spec.ts
components/application/commands/register-component/register-component.handler.ts
components/application/exceptions/component-name-already-exists.exception.ts
components/application/queries/find-component-by-name/find-component-by-name.handler.spec.ts
components/application/queries/find-component-by-name/find-component-by-name.handler.ts
components/application/queries/find-component-by-name/find-component-by-name.query.ts
components/application/queries/list-components/component.read-model.ts
components/application/queries/list-components/list-components.handler.spec.ts
components/application/queries/list-components/list-components.handler.ts
components/application/queries/list-components/list-components.query.ts
components/application/support/in-memory-component-repository.ts
components/domain/component.aggregate.spec.ts
components/domain/component.aggregate.ts
components/domain/events/component-deleted.event.ts
components/domain/events/component-registered.event.ts
components/domain/events/component-renamed.event.ts
components/domain/service/component.repository.ts
components/domain/value/component-name.vo.spec.ts
components/domain/value/component-name.vo.ts
components/infrastructure/http/controllers/component/component.controller.ts
components/infrastructure/http/controllers/component/dto/register-component.dto.ts
components/infrastructure/http/controllers/component/dto/update-component.dto.ts
components/infrastructure/persistence/component.mapper.ts
components/infrastructure/persistence/component.repository.ts
EOF
git status --short | grep -c '^R'
git ls-files src/modules/materials src/modules/components
```

Expected: the count is `64`. `git ls-files` lists exactly these 12 files, which are merged in
Step 6 and deleted in Step 7:

```
src/modules/components/application/commands/index.ts
src/modules/components/application/exceptions/index.ts
src/modules/components/application/queries/index.ts
src/modules/components/infrastructure/components.module.ts
src/modules/components/infrastructure/http/controllers/index.ts
src/modules/components/infrastructure/http/exception.mapper.ts
src/modules/materials/application/commands/index.ts
src/modules/materials/application/exceptions/index.ts
src/modules/materials/application/queries/index.ts
src/modules/materials/infrastructure/http/controllers/index.ts
src/modules/materials/infrastructure/http/exception.mapper.ts
src/modules/materials/infrastructure/materials.module.ts
```

The `find-*-by-name` folders move too. They still have one consumer until Task 2 deletes them.

- [ ] **Step 6: Write the merged files under `products/`**

Overwrite `backend/src/modules/products/application/commands/index.ts`:

```ts
import { DeleteComponentHandler } from '@products/application/commands/delete-component/delete-component.handler';
import { DeleteMaterialHandler } from '@products/application/commands/delete-material/delete-material.handler';
import { DeleteProductHandler } from '@products/application/commands/delete-product/delete-product.handler';
import { EditComponentHandler } from '@products/application/commands/edit-component/edit-component.handler';
import { EditMaterialHandler } from '@products/application/commands/edit-material/edit-material.handler';
import { EditProductHandler } from '@products/application/commands/edit-product/edit-product.handler';
import { RegisterComponentHandler } from '@products/application/commands/register-component/register-component.handler';
import { RegisterMaterialHandler } from '@products/application/commands/register-material/register-material.handler';
import { RegisterProductHandler } from '@products/application/commands/register-product/register-product.handler';

export const CommandHandlers = [
  // materials
  RegisterMaterialHandler,
  EditMaterialHandler,
  DeleteMaterialHandler,
  // components
  RegisterComponentHandler,
  EditComponentHandler,
  DeleteComponentHandler,
  // products
  RegisterProductHandler,
  EditProductHandler,
  DeleteProductHandler,
];
```

Overwrite `backend/src/modules/products/application/queries/index.ts`. The two `Find*ByName`
handlers stay registered until Task 2 removes them:

```ts
import { FindComponentByNameHandler } from '@products/application/queries/find-component-by-name/find-component-by-name.handler';
import { FindMaterialByNameHandler } from '@products/application/queries/find-material-by-name/find-material-by-name.handler';
import { GetProductHandler } from '@products/application/queries/get-product/get-product.handler';
import { ListComponentsHandler } from '@products/application/queries/list-components/list-components.handler';
import { ListMaterialsHandler } from '@products/application/queries/list-materials/list-materials.handler';
import { ListProductsHandler } from '@products/application/queries/list-products/list-products.handler';

export const QueryHandlers = [
  // materials
  ListMaterialsHandler,
  FindMaterialByNameHandler,
  // components
  ListComponentsHandler,
  FindComponentByNameHandler,
  // products
  ListProductsHandler,
  GetProductHandler,
];
```

Overwrite `backend/src/modules/products/application/exceptions/index.ts`:

```ts
export { ComponentNameAlreadyExists } from './component-name-already-exists.exception';
export { ComponentNotRegistered } from './component-not-registered.exception';
export { MaterialNameAlreadyExists } from './material-name-already-exists.exception';
export { MaterialNotRegistered } from './material-not-registered.exception';
export { ProductComponentMustHaveAtLeastOneMaterial } from './product-component-must-have-at-least-one-material.exception';
export { ProductCompositionEntryNotFound } from './product-composition-entry-not-found.exception';
export { ProductMustHaveAtLeastOneComponent } from './product-must-have-at-least-one-component.exception';
```

Overwrite `backend/src/modules/products/infrastructure/http/controllers/index.ts`:

```ts
import { ComponentController } from '@products/infrastructure/http/controllers/component/component.controller';
import { MaterialController } from '@products/infrastructure/http/controllers/material/material.controller';
import { ProductController } from '@products/infrastructure/http/controllers/product/product.controller';

// The order is load-bearing. Swagger emits routes, and the DTO schemas they
// reference, in controller registration order. Materials, components, products
// is the order they had as three modules, so keeping it keeps
// docs/openapi.json byte-identical.
export const Controllers = [
  MaterialController,
  ComponentController,
  ProductController,
];
```

Overwrite `backend/src/modules/products/infrastructure/http/exception.mapper.ts`:

```ts
import { ExceptionMapper, ProblemDetail } from '@framework/infrastructure';
import { HttpStatus } from '@nestjs/common';
import { RuntimeException } from '@nestjs/core/errors/exceptions';
import {
  ComponentNameAlreadyExists,
  ComponentNotRegistered,
  MaterialNameAlreadyExists,
  MaterialNotRegistered,
  ProductComponentMustHaveAtLeastOneMaterial,
  ProductCompositionEntryNotFound,
  ProductMustHaveAtLeastOneComponent,
} from '@products/application/exceptions';

// Maps the exceptions of all three concepts this module owns. A duplicate
// material or component name is a 409: it conflicts with existing state. Every
// product-composition case is a 400: the request's own content is at fault.
// "Name-empty" needs no case here — `RegisterProductDto`/`UpdateProductDto`
// validate nested component/material names with class-validator before the
// factory ever builds a `ComponentName`/`MaterialName` from one, so an empty
// name is an ordinary 400 validation error, not a domain exception. See
// src/modules/products/CLAUDE.md.
export class ProductsExceptionMapper implements ExceptionMapper {
  canMap(exception: unknown): boolean {
    return (
      exception instanceof MaterialNameAlreadyExists ||
      exception instanceof ComponentNameAlreadyExists ||
      exception instanceof ProductMustHaveAtLeastOneComponent ||
      exception instanceof ProductComponentMustHaveAtLeastOneMaterial ||
      exception instanceof ProductCompositionEntryNotFound ||
      exception instanceof ComponentNotRegistered ||
      exception instanceof MaterialNotRegistered
    );
  }

  toProblemDetail(exception: unknown): ProblemDetail {
    switch (true) {
      case exception instanceof MaterialNameAlreadyExists: {
        return new ProblemDetail(
          'material-name-already-exists',
          'Material Name Already Exists',
          HttpStatus.CONFLICT,
          exception.message,
          undefined,
          { name: exception.materialName.asString() },
        );
      }

      case exception instanceof ComponentNameAlreadyExists: {
        return new ProblemDetail(
          'component-name-already-exists',
          'Component Name Already Exists',
          HttpStatus.CONFLICT,
          exception.message,
          undefined,
          { name: exception.componentName.asString() },
        );
      }

      case exception instanceof ProductMustHaveAtLeastOneComponent: {
        return new ProblemDetail(
          'product-must-have-at-least-one-component',
          'Product Must Have At Least One Component',
          HttpStatus.BAD_REQUEST,
          exception.message,
        );
      }

      case exception instanceof ProductComponentMustHaveAtLeastOneMaterial: {
        return new ProblemDetail(
          'product-component-must-have-at-least-one-material',
          'Product Component Must Have At Least One Material',
          HttpStatus.BAD_REQUEST,
          exception.message,
          undefined,
          { componentName: exception.componentName },
        );
      }

      case exception instanceof ProductCompositionEntryNotFound: {
        return new ProblemDetail(
          'product-composition-entry-not-found',
          'Product Composition Entry Not Found',
          HttpStatus.BAD_REQUEST,
          exception.message,
          undefined,
          { entryId: exception.entryId },
        );
      }

      case exception instanceof ComponentNotRegistered: {
        return new ProblemDetail(
          'component-not-registered',
          'Component Not Registered',
          HttpStatus.BAD_REQUEST,
          exception.message,
          undefined,
          { componentName: exception.componentName },
        );
      }

      case exception instanceof MaterialNotRegistered: {
        return new ProblemDetail(
          'material-not-registered',
          'Material Not Registered',
          HttpStatus.BAD_REQUEST,
          exception.message,
          undefined,
          { materialName: exception.materialName },
        );
      }

      default: {
        throw new RuntimeException(
          `Unexpected exception type: ${String(exception)}`,
        );
      }
    }
  }
}
```

Overwrite `backend/src/modules/products/infrastructure/products.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { CommandHandlers } from '@products/application/commands';
import { QueryHandlers } from '@products/application/queries';
import { ProductCompositionFactory } from '@products/application/service/product-composition.factory';
import { ComponentRepository } from '@products/domain/service/component.repository';
import { MaterialRepository } from '@products/domain/service/material.repository';
import { ProductRepository } from '@products/domain/service/product.repository';
import { Controllers } from '@products/infrastructure/http/controllers';

import { PrismaComponentRepository } from './persistence/component.repository';
import { PrismaMaterialRepository } from './persistence/material.repository';
import { PrismaProductRepository } from './persistence/product.repository';

@Module({
  controllers: [...Controllers],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    ProductCompositionFactory,
    { provide: MaterialRepository, useClass: PrismaMaterialRepository },
    { provide: ComponentRepository, useClass: PrismaComponentRepository },
    { provide: ProductRepository, useClass: PrismaProductRepository },
  ],
})
export class ProductsModule {}
```

Point the characterisation spec at the merged mapper. In
`backend/src/modules/products/infrastructure/http/exception.mapper.spec.ts`, replace everything
above `function problemFor` with the block below. The rest of the file stays byte-for-byte as
written in Step 2.

```ts
import { ExceptionMapper, ProblemDetail } from '@framework/infrastructure';
import { HttpStatus } from '@nestjs/common';
import {
  ComponentNameAlreadyExists,
  ComponentNotRegistered,
  MaterialNameAlreadyExists,
  MaterialNotRegistered,
  ProductComponentMustHaveAtLeastOneMaterial,
  ProductCompositionEntryNotFound,
  ProductMustHaveAtLeastOneComponent,
} from '@products/application/exceptions';
import { ComponentName } from '@products/domain/value/component-name.vo';
import { MaterialName } from '@products/domain/value/material-name.vo';

import { ProductsExceptionMapper } from './exception.mapper';

// Pins the public Problem Details contract of every exception that materials,
// components and products map. It was written against the three separate
// mappers before they were merged, and its assertions have not changed since.
// `HttpExceptionFilter` asks the mappers in turn, so each exception must be
// claimed by exactly one of them.
const mappers: ExceptionMapper[] = [new ProductsExceptionMapper()];
```

- [ ] **Step 7: Delete the 12 merged originals and the empty directories**

```bash
cd "$(git rev-parse --show-toplevel)/backend"
git rm -q src/modules/materials/application/commands/index.ts \
          src/modules/materials/application/queries/index.ts \
          src/modules/materials/application/exceptions/index.ts \
          src/modules/materials/infrastructure/http/controllers/index.ts \
          src/modules/materials/infrastructure/http/exception.mapper.ts \
          src/modules/materials/infrastructure/materials.module.ts \
          src/modules/components/application/commands/index.ts \
          src/modules/components/application/queries/index.ts \
          src/modules/components/application/exceptions/index.ts \
          src/modules/components/infrastructure/http/controllers/index.ts \
          src/modules/components/infrastructure/http/exception.mapper.ts \
          src/modules/components/infrastructure/components.module.ts
find src/modules/materials src/modules/components -depth -type d -empty -delete 2>/dev/null
test ! -e src/modules/materials && test ! -e src/modules/components && echo gone
```

Expected: `gone`. If either directory still exists, it holds an untracked file. List it with
`find`, report it, and do not delete it blindly.

- [ ] **Step 8: Move the audit handlers into `event-handlers/products/`**

```bash
cd "$(git rev-parse --show-toplevel)/backend"
EH=src/modules/audit-logging/application/event-handlers
for f in "$EH"/materials/*.ts "$EH"/components/*.ts; do git mv "$f" "$EH/products/"; done
rmdir "$EH/materials" "$EH/components" 2>/dev/null || true
ls "$EH/products"
```

Expected: `products/` holds 12 files: the 4 product files plus
`material-{registered,edited,deleted}.handler.ts`, `materials-audit.handlers.spec.ts`,
`component-{registered,renamed,deleted}.handler.ts` and `components-audit.handlers.spec.ts`. The
specs' `./…handler` imports still resolve, because the handlers moved alongside them.

- [ ] **Step 9: Rewrite the aliases and the handler-folder import paths**

```bash
cd "$(git rev-parse --show-toplevel)/backend"
grep -rlE "@(materials|components)/" src/modules \
  | xargs -r perl -pi -e 's#\@(?:materials|components)/#\@products/#g'
grep -rlE "event-handlers/(materials|components)/" src/modules/audit-logging \
  | xargs -r perl -pi -e 's#event-handlers/(?:materials|components)/#event-handlers/products/#g'
grep -rnE "@(materials|components)/|event-handlers/(materials|components)/" src/modules
```

Expected: the last `grep` prints nothing. This rewrites every moved file, the `audit-logging`
handlers and their specs, and Step 3's `index.spec.ts`. `app.module.ts` and `exception.filter.ts`
are outside `src/modules`; Step 11 edits them by hand.

- [ ] **Step 10: Regroup the audit handler list**

In `backend/src/modules/audit-logging/application/event-handlers/index.ts`, Step 9 has already
rewritten the import paths. In the `EventHandlers` array, replace:

```ts
  // products
  ProductRegisteredAuditHandler,
  ProductRenamedAuditHandler,
  ProductDeletedAuditHandler,
  // components
  ComponentRegisteredAuditHandler,
  ComponentRenamedAuditHandler,
  ComponentDeletedAuditHandler,
  // materials
  MaterialRegisteredAuditHandler,
  MaterialEditedAuditHandler,
  MaterialDeletedAuditHandler,
```

with:

```ts
  // products: materials, components and products
  MaterialRegisteredAuditHandler,
  MaterialEditedAuditHandler,
  MaterialDeletedAuditHandler,
  ComponentRegisteredAuditHandler,
  ComponentRenamedAuditHandler,
  ComponentDeletedAuditHandler,
  ProductRegisteredAuditHandler,
  ProductRenamedAuditHandler,
  ProductDeletedAuditHandler,
```

Leave the `identity`, manufacturing-instructions and `boms` entries as the rename left them.
Step 14's `make backend/fix-lint` re-sorts the import lines.

- [ ] **Step 11: Merge the Prisma schema files**

Overwrite `backend/prisma/schema/products.prisma`. The `Material` and `Component` models are copied
verbatim from their files. The only text that changes is the `Product` header comment, which said
the factory "created" the master rows:

```prisma
model Material {
  id        String   @id @default(uuid())
  // Unlike User's username, no other data references a material yet, so a
  // plain unique constraint is sufficient — there is no soft-delete state to
  // carve out of it.
  name      String   @unique
  // Optional, trimmed, and deliberately not unique — two materials may share
  // a code. `null` when the material has none (a blank code is stored as null).
  code      String?  @map("code")
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz

  @@map("material")
}

model Component {
  id        String   @id @default(uuid())
  // A component has no relation to any other BOM entity (no material, no
  // product) — an orphan component, registered standalone, is valid — so a
  // plain unique constraint is sufficient, mirroring Material's.
  name      String   @unique
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz

  @@map("component")
}

// A product's composition is owned data, not a reference: `product_component`
// and `product_material` store a copy of the `componentId`/name and
// `materialId`/name that `ProductCompositionFactory` resolved from an
// already-registered `Component`/`Material` row — not a foreign key into
// `component`/`material`. Those rows (the two models above) outlive the
// product that once composed them (see `Product.delete()`'s doc comment and
// `src/modules/products/CLAUDE.md`).
model Product {
  id         String   @id @default(uuid())
  name       String
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt  DateTime @updatedAt @map("updated_at") @db.Timestamptz
  components ProductComponent[]

  @@map("product")
}

model ProductComponent {
  id          String @id @default(uuid())
  productId   String @map("product_id")
  // The id of the standalone `Component` row this line was built from — not
  // a Prisma relation (see the note on `Product` above).
  componentId String @map("component_id")
  name        String

  product   Product           @relation(fields: [productId], references: [id], onDelete: Cascade)
  materials ProductMaterial[]

  @@map("product_component")
}

model ProductMaterial {
  id                 String @id @default(uuid())
  productComponentId String @map("product_component_id")
  // The id of the standalone `Material` row this line was built from — not
  // a Prisma relation, for the same reason as `ProductComponent.componentId`.
  materialId         String @map("material_id")
  name               String

  productComponent ProductComponent @relation(fields: [productComponentId], references: [id], onDelete: Cascade)

  @@map("product_material")
}
```

Then:

```bash
cd "$(git rev-parse --show-toplevel)/backend"
git rm -q prisma/schema/materials.prisma prisma/schema/components.prisma
ls prisma/schema
```

Expected:
`_config.prisma  audit-logging.prisma  boms.prisma  identity.prisma  manufacturing-instructions.prisma  products.prisma`.

- [ ] **Step 12: Update aliases, `app.module.ts` and `exception.filter.ts`**

In `backend/tsconfig.json`, delete these two lines from `paths`:

```json
      "@materials/*": ["src/modules/materials/*"],
      "@components/*": ["src/modules/components/*"],
```

In `backend/package.json`, delete these two lines from `jest.moduleNameMapper`:

```json
      "^@materials/(.*)$": "<rootDir>/modules/materials/$1",
      "^@components/(.*)$": "<rootDir>/modules/components/$1",
```

In `backend/src/app.module.ts`:
- Delete the import line
  `import { ComponentsModule } from '@components/infrastructure/components.module';`.
- Delete the import line
  `import { MaterialsModule } from '@materials/infrastructure/materials.module';`.
- In the `imports` array, replace

  ```ts
      MaterialsModule,
      ComponentsModule,
      ProductsModule,
  ```

  with

  ```ts
      ProductsModule,
  ```

In `backend/src/framework/infrastructure/http/exception.filter.ts`:
- Delete the import line
  `import { ComponentsExceptionMapper } from '@components/infrastructure/http/exception.mapper';`.
- Delete the import line
  `import { MaterialsExceptionMapper } from '@materials/infrastructure/http/exception.mapper';`.
- In `ExceptionMappers`, delete the lines `  new MaterialsExceptionMapper(),` and
  `  new ComponentsExceptionMapper(),`.
- Replace the comment above `const ExceptionMappers` with:

  ```ts
  // Framework first, then each module's own mapper — register a new module's mapper here (see
  // backend/CLAUDE.md's "Exception Handling" section, step 3). Order among the module mappers
  // themselves doesn't matter beyond that: none of them match the same exception type, so only one
  // can ever claim a given exception.
  ```

The array is now Framework, Identity, Products, ManufacturingInstructions, Boms.

- [ ] **Step 13: Update dependency-cruiser**

In `backend/.dependency-cruiser.cjs`:

**a. `modules-isolated`, `from.pathNot`.** Remove the factory exemption. Before:

```js
        pathNot:
          '^src/modules/(products/application/service/product-composition\\.factory\\.ts|manufacturing-instructions/application/service/manufacturing-instruction-composition\\.factory\\.ts|boms/application/service/bom-composition\\.factory\\.ts|boms/application/queries/get-product-daily-boms/get-product-daily-boms\\.handler\\.ts|audit-logging/application/event-handlers/[^/]+/[^/]+\\.ts)$',
```

After:

```js
        pathNot:
          '^src/modules/(manufacturing-instructions/application/service/manufacturing-instruction-composition\\.factory\\.ts|boms/application/service/bom-composition\\.factory\\.ts|boms/application/queries/get-product-daily-boms/get-product-daily-boms\\.handler\\.ts|audit-logging/application/event-handlers/[^/]+/[^/]+\\.ts)$',
```

**b. `modules-isolated`, `comment`.** Replace the whole `comment:` value. It wrongly says that
`ProductCompositionFactory` reuses `RegisterComponentCommand`/`RegisterMaterialCommand`. The
replacement:

```js
      comment:
        'A feature module must not import another module internally. Cross-module ' +
        'interaction goes over HTTP, not by importing code. The documented exceptions are ' +
        '`ManufacturingInstructionCompositionFactory`, which reuses products\' own ' +
        'GetProductQuery through the QueryBus to read a product\'s current composition, ' +
        '`BomCompositionFactory`, which reuses manufacturing-instructions\' own ' +
        'GetManufacturingInstructionByMiCodeQuery through the QueryBus to read a manufacturing ' +
        'instruction\'s current composition, `GetProductDailyBomsHandler`, which reuses ' +
        'manufacturing-instructions\' own GetManufacturingInstructionDetailQuery through the ' +
        'QueryBus to read each daily BOM\'s referenced manufacturing instruction\'s current ' +
        'composition for the score, and `audit-logging`\'s own application/event-handlers/**, ' +
        'which subscribe directly to the domain events the four other modules already emit ' +
        'rather than reusing a command/query — see ' +
        'src/modules/manufacturing-instructions/CLAUDE.md, src/modules/boms/CLAUDE.md and ' +
        'src/modules/audit-logging/CLAUDE.md, and the narrower rules below that bound exactly ' +
        'what each may import.',
```

**c. Delete the whole rule object `product-composition-factory-reuse-is-narrow`.** That is
everything from its `{` through its closing `},`, which sits directly after `modules-isolated`.
Leave `manufacturing-instruction-composition-factory-reuse-is-narrow` as it is, including its
`to.pathNot` on `products/application/queries/(get-product/…|list-products/product.read-model.ts)`.

**d. `audit-logging-event-handlers-reuse-is-narrow`.** Replace the whole rule object with:

```js
    {
      name: 'audit-logging-event-handlers-reuse-is-narrow',
      comment:
        '`audit-logging` is a pure read-side projector with no aggregate of its own (see ' +
        'src/modules/audit-logging/CLAUDE.md): its application/event-handlers/** subscribe to ' +
        'the mutating domain events `identity`, `products`, `manufacturing-instructions` and ' +
        '`boms` already emit, and writes its own denormalized read tables. ' +
        'Knowing another module\'s event *shape* is the one legitimate exception to module ' +
        'isolation here — the same category of justified exception as the composition-factory ' +
        'reuse carve-outs above — so this rule pins those handlers to importing only the four ' +
        'modules\' own domain/events/*.ts files: no aggregates, no repositories, no application ' +
        'code, no read models.',
      severity: 'error',
      from: { path: '^src/modules/audit-logging/application/event-handlers/' },
      to: {
        path: '^src/modules/(identity|products|manufacturing-instructions|boms)/',
        pathNot:
          '^src/modules/(identity|products|manufacturing-instructions|boms)/domain/events/[^/]+\\.ts$',
      },
    },
```

Then check:

```bash
grep -n "product-composition\|components|materials\|RegisterComponentCommand" backend/.dependency-cruiser.cjs
```

Expected: no output.

- [ ] **Step 14: Rebuild the image, then verify**

From the repo root:

```bash
make backend/build
docker compose -f backend/docker-compose.yml run --rm --no-deps app npx tsc --noEmit -p tsconfig.json
make backend/fix-lint
make backend/run-unit-tests
make backend/lint-architecture
make backend/lint-swagger
make backend/lint
make backend/format
```

The rebuild regenerates the Prisma client from the merged schema folder. The models are unchanged,
so the client should be too.

Expected: every command exits 0. The suite count equals the Step 1 baseline plus 10, for the 9 new
mapper tests and the 1 wiring test. `fix-lint` only re-sorts imports in the files whose alias
changed.

If something fails:
- `tsc` reports a missing export: a barrel in Step 6 lost a name. Re-add it; never re-add an alias.
- dependency-cruiser reports a violation: a Step 13 regex is wrong. Fix the regex; never loosen a
  rule.
- `lint-swagger` reports a diff: check the `Controllers` order in Step 6 first.
- `make backend/format` fails: run `make backend/fix-format` and re-run it.

- [ ] **Step 15: Commit**

```bash
git add -A backend
git commit -m "wip: move materials and components into products"
```

---

### Task 2: Resolve composition names through the repositories, not the QueryBus

**Files:**
- Modify:
  - `backend/src/modules/products/application/service/product-composition.factory.ts`
  - `backend/src/modules/products/application/service/product-composition.factory.spec.ts`
  - `backend/src/modules/products/application/commands/register-product/register-product.handler.spec.ts`
  - `backend/src/modules/products/application/commands/edit-product/edit-product.handler.spec.ts`
  - `backend/src/modules/products/application/queries/index.ts`
- Delete:
  - `backend/src/modules/products/application/queries/find-material-by-name/`, which holds the
    query, the handler and its spec
  - `backend/src/modules/products/application/queries/find-component-by-name/`, which holds the
    query, the handler and its spec
  - `backend/src/modules/products/application/support/stub-query-bus.ts`, which has no users left
  - `backend/src/modules/products/application/support/stub-command-bus.ts`, which has had no users
    since before this change. Its comment describes the cross-module boundary this task removes.

**Interfaces:**
- Consumes: Task 1's `Produces` list.
- Produces: `new ProductCompositionFactory(componentRepository: ComponentRepository, materialRepository: MaterialRepository)`.
  The public methods `createComponentLines` and `reconcileComponentLines` are unchanged.

- [ ] **Step 1: Rewrite the factory spec against the in-memory repositories**

Overwrite `backend/src/modules/products/application/service/product-composition.factory.spec.ts`.
Every case keeps its assertion, with two kinds of exception:
- the scripted ids (`'component-1'`, …) become the seeded aggregates' ids;
- assertions on dispatched queries had no subject left. In "resolving nothing" and "resolving only
  the new material", leaving a name unregistered means resolving it would throw, so a successful
  result proves it was not resolved. "Resolving it only once" spies on the repository. The case
  "dispatches a FindComponentByNameQuery and a FindMaterialByNameQuery built from the given names"
  is dropped. It asserted the bus messages themselves. Lookup by the exact given name is still
  pinned by the first, second and casing cases.

```ts
import { Identity } from '@framework/domain';
import {
  ComponentNotRegistered,
  MaterialNotRegistered,
  ProductCompositionEntryNotFound,
} from '@products/application/exceptions';
import { InMemoryComponentRepository } from '@products/application/support/in-memory-component-repository';
import { InMemoryMaterialRepository } from '@products/application/support/in-memory-material-repository';
import { Component } from '@products/domain/component.aggregate';
import { Material } from '@products/domain/material.aggregate';
import { ComponentName } from '@products/domain/value/component-name.vo';
import { MaterialName } from '@products/domain/value/material-name.vo';
import { ProductComponentLine } from '@products/domain/value/product-component-line.vo';
import { ProductMaterialLine } from '@products/domain/value/product-material-line.vo';

import { ProductCompositionFactory } from './product-composition.factory';

function makeSut() {
  const componentRepository = new InMemoryComponentRepository();
  const materialRepository = new InMemoryMaterialRepository();
  const sut = new ProductCompositionFactory(
    componentRepository,
    materialRepository,
  );
  const registeredComponent = (name: string): Component =>
    componentRepository.seed(
      Component.register(ComponentName.fromString(name)),
    );
  const registeredMaterial = (name: string): Material =>
    materialRepository.seed(
      Material.register(MaterialName.fromString(name), null),
    );
  return { sut, materialRepository, registeredComponent, registeredMaterial };
}

describe('ProductCompositionFactory', () => {
  it('creates a component line carrying the id and name of an already-registered component and material', async () => {
    const { sut, registeredComponent, registeredMaterial } = makeSut();
    const bolt = registeredComponent('Bolt');
    const steelRod = registeredMaterial('Steel Rod');

    const lines = await sut.createComponentLines([
      { name: 'Bolt', materials: [{ name: 'Steel Rod' }] },
    ]);

    expect(lines).toHaveLength(1);
    expect(lines[0].componentId().asString()).toBe(bolt.id.asString());
    expect(lines[0].name()).toBe('Bolt');
    expect(lines[0].materials()).toHaveLength(1);
    expect(lines[0].materials()[0].materialId().asString()).toBe(
      steelRod.id.asString(),
    );
    expect(lines[0].materials()[0].name()).toBe('Steel Rod');
  });

  it('resolves every component and material listed to their own already-registered id', async () => {
    const { sut, registeredComponent, registeredMaterial } = makeSut();
    const bolt = registeredComponent('Bolt');
    const nut = registeredComponent('Nut');
    const steelRod = registeredMaterial('Steel Rod');
    const copperWire = registeredMaterial('Copper Wire');

    const lines = await sut.createComponentLines([
      { name: 'Bolt', materials: [{ name: 'Steel Rod' }] },
      { name: 'Nut', materials: [{ name: 'Copper Wire' }] },
    ]);

    expect(lines.map((line) => line.componentId().asString())).toEqual([
      bolt.id.asString(),
      nut.id.asString(),
    ]);
    expect(
      lines.map((line) => line.materials()[0].materialId().asString()),
    ).toEqual([steelRod.id.asString(), copperWire.id.asString()]);
  });

  it('reuses the same material across two different components of one product, resolving it only once', async () => {
    const { sut, materialRepository, registeredComponent, registeredMaterial } =
      makeSut();
    registeredComponent('مغزی');
    registeredComponent('روکش');
    const copper = registeredMaterial('مسی');
    const findMaterialByName = jest.spyOn(materialRepository, 'findByName');

    const lines = await sut.createComponentLines([
      { name: 'مغزی', materials: [{ name: 'مسی' }] },
      { name: 'روکش', materials: [{ name: 'مسی' }] },
    ]);

    expect(lines).toHaveLength(2);
    expect(lines[0].materials()[0].materialId().asString()).toBe(
      copper.id.asString(),
    );
    expect(lines[1].materials()[0].materialId().asString()).toBe(
      copper.id.asString(),
    );
    expect(lines[1].materials()[0]).toEqual(lines[0].materials()[0]);
    expect(findMaterialByName).toHaveBeenCalledTimes(1);
    expect(findMaterialByName).toHaveBeenCalledWith(
      MaterialName.fromString('مسی'),
    );
  });

  it('still resolves materials that only share a name with a material of a different casing', async () => {
    const { sut, registeredComponent, registeredMaterial } = makeSut();
    registeredComponent('Core');
    registeredComponent('Sheath');
    const upperCase = registeredMaterial('Steel Rod');
    const lowerCase = registeredMaterial('steel rod');

    const lines = await sut.createComponentLines([
      { name: 'Core', materials: [{ name: 'Steel Rod' }] },
      { name: 'Sheath', materials: [{ name: 'steel rod' }] },
    ]);

    expect(lines[0].materials()[0].materialId().asString()).toBe(
      upperCase.id.asString(),
    );
    expect(lines[1].materials()[0].materialId().asString()).toBe(
      lowerCase.id.asString(),
    );
  });

  it('rejects registering a product with a component name that is not already registered', async () => {
    const { sut } = makeSut();

    await expect(
      sut.createComponentLines([
        { name: 'Bolt', materials: [{ name: 'Steel Rod' }] },
      ]),
    ).rejects.toThrow(ComponentNotRegistered);
  });

  it('carries the attempted name on ComponentNotRegistered', async () => {
    const { sut } = makeSut();

    await expect(
      sut.createComponentLines([
        { name: 'Bolt', materials: [{ name: 'Steel Rod' }] },
      ]),
    ).rejects.toMatchObject({ componentName: 'Bolt' });
  });

  it('rejects registering a product with a material name that is not already registered, once its component resolves', async () => {
    const { sut, registeredComponent } = makeSut();
    registeredComponent('Bolt');

    await expect(
      sut.createComponentLines([
        { name: 'Bolt', materials: [{ name: 'Steel Rod' }] },
      ]),
    ).rejects.toThrow(MaterialNotRegistered);
  });

  it('carries the attempted name on MaterialNotRegistered', async () => {
    const { sut, registeredComponent } = makeSut();
    registeredComponent('Bolt');

    await expect(
      sut.createComponentLines([
        { name: 'Bolt', materials: [{ name: 'Steel Rod' }] },
      ]),
    ).rejects.toMatchObject({ materialName: 'Steel Rod' });
  });
});

function existingComponentLine(): ProductComponentLine {
  return ProductComponentLine.of(Identity.new(), 'Bolt', [
    ProductMaterialLine.of(Identity.new(), 'Steel Rod'),
  ]);
}

describe('ProductCompositionFactory.reconcileComponentLines', () => {
  it('reuses an existing component and material as-is when their ids are given, resolving nothing', async () => {
    // Nothing is registered, so resolving "Bolt" or "Steel Rod" by name would
    // throw: getting the lines back proves neither was resolved.
    const { sut } = makeSut();
    const existing = existingComponentLine();

    const lines = await sut.reconcileComponentLines(
      [existing],
      [
        {
          id: existing.componentId().asString(),
          name: existing.name(),
          materials: [
            {
              id: existing.materials()[0].materialId().asString(),
              name: existing.materials()[0].name(),
            },
          ],
        },
      ],
    );

    expect(lines).toEqual([existing]);
  });

  it('adds a new material to an existing component, resolving only the new material', async () => {
    // Only "Copper Wire" is registered: re-resolving the existing "Bolt" or
    // "Steel Rod" by name would throw.
    const { sut, registeredMaterial } = makeSut();
    const copperWire = registeredMaterial('Copper Wire');
    const existing = existingComponentLine();
    const existingMaterial = existing.materials()[0];

    const lines = await sut.reconcileComponentLines(
      [existing],
      [
        {
          id: existing.componentId().asString(),
          name: existing.name(),
          materials: [
            {
              id: existingMaterial.materialId().asString(),
              name: existingMaterial.name(),
            },
            { name: 'Copper Wire' },
          ],
        },
      ],
    );

    expect(lines).toHaveLength(1);
    expect(lines[0].componentId()).toEqual(existing.componentId());
    expect(lines[0].materials()).toEqual([
      existingMaterial,
      ProductMaterialLine.of(copperWire.id, 'Copper Wire'),
    ]);
  });

  it('resolves a component with no id exactly like createComponentLines, by name', async () => {
    const { sut, registeredComponent, registeredMaterial } = makeSut();
    const nut = registeredComponent('Nut');
    registeredMaterial('Copper Wire');

    const lines = await sut.reconcileComponentLines(
      [existingComponentLine()],
      [{ name: 'Nut', materials: [{ name: 'Copper Wire' }] }],
    );

    expect(lines).toHaveLength(1);
    expect(lines[0].componentId().asString()).toBe(nut.id.asString());
    expect(lines[0].name()).toBe('Nut');
  });

  it('reuses a globally existing component/material for a new (id-less) entry', async () => {
    const { sut, registeredComponent, registeredMaterial } = makeSut();
    const nut = registeredComponent('Nut');
    const copperWire = registeredMaterial('Copper Wire');

    const lines = await sut.reconcileComponentLines(
      [existingComponentLine()],
      [{ name: 'Nut', materials: [{ name: 'Copper Wire' }] }],
    );

    expect(lines).toHaveLength(1);
    expect(lines[0].componentId().asString()).toBe(nut.id.asString());
    expect(lines[0].materials()[0].materialId().asString()).toBe(
      copperWire.id.asString(),
    );
  });

  it('rejects a component id that is not part of the given current composition', async () => {
    const { sut } = makeSut();

    await expect(
      sut.reconcileComponentLines(
        [existingComponentLine()],
        [
          {
            id: Identity.new().asString(),
            name: 'Bolt',
            materials: [{ name: 'Steel Rod' }],
          },
        ],
      ),
    ).rejects.toBeInstanceOf(ProductCompositionEntryNotFound);
  });

  it("rejects a material id that is not part of the referenced component's current materials", async () => {
    const { sut } = makeSut();
    const existing = existingComponentLine();

    await expect(
      sut.reconcileComponentLines(
        [existing],
        [
          {
            id: existing.componentId().asString(),
            name: existing.name(),
            materials: [{ id: Identity.new().asString(), name: 'Steel Rod' }],
          },
        ],
      ),
    ).rejects.toBeInstanceOf(ProductCompositionEntryNotFound);
  });

  it('rejects editing a product with a new (id-less) component name that is not already registered', async () => {
    const { sut, registeredMaterial } = makeSut();
    registeredMaterial('Copper Wire');

    await expect(
      sut.reconcileComponentLines(
        [existingComponentLine()],
        [{ name: 'Nut', materials: [{ name: 'Copper Wire' }] }],
      ),
    ).rejects.toBeInstanceOf(ComponentNotRegistered);
  });

  it('rejects editing an existing component with a new (id-less) material name that is not already registered', async () => {
    const { sut } = makeSut();
    const existing = existingComponentLine();

    await expect(
      sut.reconcileComponentLines(
        [existing],
        [
          {
            id: existing.componentId().asString(),
            name: existing.name(),
            materials: [{ name: 'Copper Wire' }],
          },
        ],
      ),
    ).rejects.toBeInstanceOf(MaterialNotRegistered);
  });
});
```

- [ ] **Step 2: Rewrite the register-product handler spec**

Overwrite
`backend/src/modules/products/application/commands/register-product/register-product.handler.spec.ts`:

```ts
import { Identity } from '@framework/domain';
import {
  ComponentNotRegistered,
  MaterialNotRegistered,
  ProductComponentMustHaveAtLeastOneMaterial,
  ProductMustHaveAtLeastOneComponent,
} from '@products/application/exceptions';
import { ProductCompositionFactory } from '@products/application/service/product-composition.factory';
import { InMemoryComponentRepository } from '@products/application/support/in-memory-component-repository';
import { InMemoryMaterialRepository } from '@products/application/support/in-memory-material-repository';
import { InMemoryProductRepository } from '@products/application/support/in-memory-product-repository';
import { Component } from '@products/domain/component.aggregate';
import { Material } from '@products/domain/material.aggregate';
import { ComponentName } from '@products/domain/value/component-name.vo';
import { MaterialName } from '@products/domain/value/material-name.vo';
import { ProductName } from '@products/domain/value/product-name.vo';

import { RegisterProductCommand } from './register-product.command';
import { RegisterProductHandler } from './register-product.handler';

function makeSut() {
  const productRepository = new InMemoryProductRepository();
  const componentRepository = new InMemoryComponentRepository();
  const materialRepository = new InMemoryMaterialRepository();
  const compositionFactory = new ProductCompositionFactory(
    componentRepository,
    materialRepository,
  );
  const sut = new RegisterProductHandler(productRepository, compositionFactory);
  const registeredComponent = (name: string): Component =>
    componentRepository.seed(
      Component.register(ComponentName.fromString(name)),
    );
  const registeredMaterial = (name: string): Material =>
    materialRepository.seed(
      Material.register(MaterialName.fromString(name), null),
    );
  return { sut, productRepository, registeredComponent, registeredMaterial };
}

describe('RegisterProductHandler', () => {
  it('registers a new product, resolving its component and material to already-registered rows', async () => {
    const { sut, productRepository, registeredComponent, registeredMaterial } =
      makeSut();
    const bolt = registeredComponent('Bolt');
    const steelRod = registeredMaterial('Steel Rod');

    const result = await sut.execute(
      new RegisterProductCommand(ProductName.fromString('Widget'), [
        { name: 'Bolt', materials: [{ name: 'Steel Rod' }] },
      ]),
    );

    expect(result.name).toBe('Widget');
    expect(result.components).toEqual([
      {
        id: bolt.id.asString(),
        name: 'Bolt',
        materials: [{ id: steelRod.id.asString(), name: 'Steel Rod' }],
      },
    ]);
    const saved = await productRepository.get(Identity.fromString(result.id));
    expect(saved.name().asString()).toBe('Widget');
  });

  it('rejects registering a product with no components', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(
        new RegisterProductCommand(ProductName.fromString('Widget'), []),
      ),
    ).rejects.toBeInstanceOf(ProductMustHaveAtLeastOneComponent);
  });

  it('rejects registering a product whose component has no materials', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(
        new RegisterProductCommand(ProductName.fromString('Widget'), [
          { name: 'Bolt', materials: [] },
        ]),
      ),
    ).rejects.toBeInstanceOf(ProductComponentMustHaveAtLeastOneMaterial);
  });

  it('rejects registering a product with a component that is not already registered', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(
        new RegisterProductCommand(ProductName.fromString('Widget'), [
          { name: 'Bolt', materials: [{ name: 'Steel Rod' }] },
        ]),
      ),
    ).rejects.toBeInstanceOf(ComponentNotRegistered);
  });

  it('rejects registering a product with a material that is not already registered', async () => {
    const { sut, registeredComponent } = makeSut();
    registeredComponent('Bolt');

    await expect(
      sut.execute(
        new RegisterProductCommand(ProductName.fromString('Widget'), [
          { name: 'Bolt', materials: [{ name: 'Steel Rod' }] },
        ]),
      ),
    ).rejects.toBeInstanceOf(MaterialNotRegistered);
  });
});
```

- [ ] **Step 3: Rewrite the edit-product handler spec**

Overwrite
`backend/src/modules/products/application/commands/edit-product/edit-product.handler.spec.ts`:

```ts
import { EntityNotFound, Identity } from '@framework/domain';
import {
  ComponentNotRegistered,
  MaterialNotRegistered,
  ProductComponentMustHaveAtLeastOneMaterial,
  ProductCompositionEntryNotFound,
  ProductMustHaveAtLeastOneComponent,
} from '@products/application/exceptions';
import { ProductCompositionFactory } from '@products/application/service/product-composition.factory';
import { InMemoryComponentRepository } from '@products/application/support/in-memory-component-repository';
import { InMemoryMaterialRepository } from '@products/application/support/in-memory-material-repository';
import { InMemoryProductRepository } from '@products/application/support/in-memory-product-repository';
import { Component } from '@products/domain/component.aggregate';
import { Material } from '@products/domain/material.aggregate';
import { Product } from '@products/domain/product.aggregate';
import { ComponentName } from '@products/domain/value/component-name.vo';
import { MaterialName } from '@products/domain/value/material-name.vo';
import { ProductComponentLine } from '@products/domain/value/product-component-line.vo';
import { ProductMaterialLine } from '@products/domain/value/product-material-line.vo';
import { ProductName } from '@products/domain/value/product-name.vo';

import { EditProductCommand } from './edit-product.command';
import { EditProductHandler } from './edit-product.handler';

function makeSut() {
  const productRepository = new InMemoryProductRepository();
  const componentRepository = new InMemoryComponentRepository();
  const materialRepository = new InMemoryMaterialRepository();
  const compositionFactory = new ProductCompositionFactory(
    componentRepository,
    materialRepository,
  );
  const sut = new EditProductHandler(productRepository, compositionFactory);
  const registeredComponent = (name: string): Component =>
    componentRepository.seed(
      Component.register(ComponentName.fromString(name)),
    );
  const registeredMaterial = (name: string): Material =>
    materialRepository.seed(
      Material.register(MaterialName.fromString(name), null),
    );
  return { sut, productRepository, registeredComponent, registeredMaterial };
}

// The seeded product's "Bolt"/"Steel Rod" lines carry fresh ids that are not
// registered as a `Component`/`Material`, so any attempt to re-resolve them by
// name throws ComponentNotRegistered/MaterialNotRegistered.
function seedProduct(
  productRepository: InMemoryProductRepository,
  name: string,
): Product {
  return productRepository.seed(
    Product.register(ProductName.fromString(name), [
      ProductComponentLine.of(Identity.new(), 'Bolt', [
        ProductMaterialLine.of(Identity.new(), 'Steel Rod'),
      ]),
    ]),
  );
}

describe('EditProductHandler', () => {
  it('renames a product, leaving its components untouched', async () => {
    const { sut, productRepository } = makeSut();
    const product = seedProduct(productRepository, 'Widget');
    const originalComponents = product.components();

    await sut.execute(
      new EditProductCommand(product.id, ProductName.fromString('Gadget')),
    );

    const saved = await productRepository.get(product.id);
    expect(saved.name().asString()).toBe('Gadget');
    expect(saved.components()).toEqual(originalComponents);
  });

  it("replaces a product's components with newly resolved ones, leaving its name untouched", async () => {
    const { sut, productRepository, registeredComponent, registeredMaterial } =
      makeSut();
    const product = seedProduct(productRepository, 'Widget');
    const nut = registeredComponent('Nut');
    registeredMaterial('Copper Wire');

    await sut.execute(
      new EditProductCommand(product.id, undefined, [
        { name: 'Nut', materials: [{ name: 'Copper Wire' }] },
      ]),
    );

    const saved = await productRepository.get(product.id);
    expect(saved.name().asString()).toBe('Widget');
    expect(saved.components()).toHaveLength(1);
    expect(saved.components()[0].componentId().asString()).toBe(
      nut.id.asString(),
    );
    expect(saved.components()[0].name()).toBe('Nut');
  });

  it('rejects editing a product to have no components', async () => {
    const { sut, productRepository } = makeSut();
    const product = seedProduct(productRepository, 'Widget');

    await expect(
      sut.execute(new EditProductCommand(product.id, undefined, [])),
    ).rejects.toBeInstanceOf(ProductMustHaveAtLeastOneComponent);
  });

  it('rejects editing a product so that a component has no materials', async () => {
    const { sut, productRepository } = makeSut();
    const product = seedProduct(productRepository, 'Widget');

    await expect(
      sut.execute(
        new EditProductCommand(product.id, undefined, [
          { name: 'Nut', materials: [] },
        ]),
      ),
    ).rejects.toBeInstanceOf(ProductComponentMustHaveAtLeastOneMaterial);
  });

  it('rejects editing a product that does not exist', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(
        new EditProductCommand(
          Identity.new(),
          ProductName.fromString('Widget'),
        ),
      ),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });

  it('renames a product while resending its unchanged component and material by id, resolving nothing new', async () => {
    // Nothing is registered: succeeding proves no name was resolved.
    const { sut, productRepository } = makeSut();
    const product = seedProduct(productRepository, 'Widget');
    const existingComponent = product.components()[0];
    const existingMaterial = existingComponent.materials()[0];

    await sut.execute(
      new EditProductCommand(product.id, ProductName.fromString('Gadget'), [
        {
          id: existingComponent.componentId().asString(),
          name: existingComponent.name(),
          materials: [
            {
              id: existingMaterial.materialId().asString(),
              name: existingMaterial.name(),
            },
          ],
        },
      ]),
    );

    const saved = await productRepository.get(product.id);
    expect(saved.name().asString()).toBe('Gadget');
    expect(saved.components()).toEqual([existingComponent]);
  });

  it('adds a new material to an existing component referenced by id, resolving only the new material', async () => {
    const { sut, productRepository, registeredMaterial } = makeSut();
    const copperWire = registeredMaterial('Copper Wire');
    const product = seedProduct(productRepository, 'Widget');
    const existingComponent = product.components()[0];
    const existingMaterial = existingComponent.materials()[0];

    await sut.execute(
      new EditProductCommand(product.id, undefined, [
        {
          id: existingComponent.componentId().asString(),
          name: existingComponent.name(),
          materials: [
            {
              id: existingMaterial.materialId().asString(),
              name: existingMaterial.name(),
            },
            { name: 'Copper Wire' },
          ],
        },
      ]),
    );

    const saved = await productRepository.get(product.id);
    expect(saved.components()).toHaveLength(1);
    expect(saved.components()[0].componentId()).toEqual(
      existingComponent.componentId(),
    );
    expect(saved.components()[0].materials()).toHaveLength(2);
    expect(saved.components()[0].materials()[0]).toEqual(existingMaterial);
    expect(saved.components()[0].materials()[1].name()).toBe('Copper Wire');
    expect(saved.components()[0].materials()[1].materialId().asString()).toBe(
      copperWire.id.asString(),
    );
  });

  it("rejects a component id that isn't part of this product's current composition", async () => {
    const { sut, productRepository } = makeSut();
    const product = seedProduct(productRepository, 'Widget');

    await expect(
      sut.execute(
        new EditProductCommand(product.id, undefined, [
          {
            id: Identity.new().asString(),
            name: 'Bolt',
            materials: [{ name: 'Steel Rod' }],
          },
        ]),
      ),
    ).rejects.toBeInstanceOf(ProductCompositionEntryNotFound);
  });

  it("rejects a material id that isn't part of the referenced component's current materials", async () => {
    const { sut, productRepository } = makeSut();
    const product = seedProduct(productRepository, 'Widget');
    const existingComponent = product.components()[0];

    await expect(
      sut.execute(
        new EditProductCommand(product.id, undefined, [
          {
            id: existingComponent.componentId().asString(),
            name: existingComponent.name(),
            materials: [{ id: Identity.new().asString(), name: 'Steel Rod' }],
          },
        ]),
      ),
    ).rejects.toBeInstanceOf(ProductCompositionEntryNotFound);
  });

  it('rejects editing a product with a new (id-less) component that is not already registered', async () => {
    const { sut, productRepository, registeredMaterial } = makeSut();
    const product = seedProduct(productRepository, 'Widget');
    registeredMaterial('Copper Wire');

    await expect(
      sut.execute(
        new EditProductCommand(product.id, undefined, [
          { name: 'Nut', materials: [{ name: 'Copper Wire' }] },
        ]),
      ),
    ).rejects.toBeInstanceOf(ComponentNotRegistered);
  });

  it('rejects adding a new (id-less) material to an existing component that is not already registered', async () => {
    const { sut, productRepository } = makeSut();
    const product = seedProduct(productRepository, 'Widget');
    const existingComponent = product.components()[0];
    const existingMaterial = existingComponent.materials()[0];

    await expect(
      sut.execute(
        new EditProductCommand(product.id, undefined, [
          {
            id: existingComponent.componentId().asString(),
            name: existingComponent.name(),
            materials: [
              {
                id: existingMaterial.materialId().asString(),
                name: existingMaterial.name(),
              },
              { name: 'Copper Wire' },
            ],
          },
        ]),
      ),
    ).rejects.toBeInstanceOf(MaterialNotRegistered);
  });
});
```

- [ ] **Step 4: Run the three specs to see them fail**

```bash
docker compose -f backend/docker-compose.yml run --rm --no-deps app \
  npx jest modules/products/application/service modules/products/application/commands/register-product modules/products/application/commands/edit-product
```

Expected: FAIL in all three suites, with a ts-jest type error at `new ProductCompositionFactory(`.
The error is "Expected 1 arguments, but got 2", or "Argument of type
'InMemoryComponentRepository' is not assignable to parameter of type 'QueryBus'".

- [ ] **Step 5: Switch `ProductCompositionFactory` to the repositories**

In `backend/src/modules/products/application/service/product-composition.factory.ts`:

**a. Imports.** Replace the whole import block, everything above the `/**` class doc comment,
with:

```ts
import { Identity } from '@framework/domain';
import { Injectable } from '@nestjs/common';
import {
  EditProductComponentInput,
  EditProductMaterialInput,
  RegisterProductComponentInput,
} from '@products/application/commands/product-component.input';
import {
  ComponentNotRegistered,
  MaterialNotRegistered,
  ProductCompositionEntryNotFound,
} from '@products/application/exceptions';
import { ComponentRepository } from '@products/domain/service/component.repository';
import { MaterialRepository } from '@products/domain/service/material.repository';
import { ComponentName } from '@products/domain/value/component-name.vo';
import { MaterialName } from '@products/domain/value/material-name.vo';
import { ProductComponentLine } from '@products/domain/value/product-component-line.vo';
import { ProductMaterialLine } from '@products/domain/value/product-material-line.vo';
```

**b. Class doc comment, first bullet.** Before:

```ts
 * - `createComponentLines` (registration): every component/material entry is
 *   resolved to a `components`/`materials` master row that already exists
 *   (see the name-resolution note below). There is never a pre-existing
```

After:

```ts
 * - `createComponentLines` (registration): every component/material entry is
 *   resolved to a `Component`/`Material` that is already registered (see the
 *   name-resolution note below). There is never a pre-existing
```

**c. Class doc comment, "Name resolution" paragraph.** Before:

```ts
 * **Name resolution.** For every component/material name that isn't reused
 * verbatim from the product's own current composition (i.e. every entry
 * `createComponentLines` handles, and every id-less new entry
 * `reconcileComponentLines` handles), this factory dispatches
 * `FindComponentByNameQuery`/`FindMaterialByNameQuery` on the `QueryBus` to
 * check whether a row with that exact name already exists **globally** —
 * "Copper", "Core", "Jacket" are raw-material/component vocabulary real
 * products legitimately share, not reinvent per product — and reuses its id
 * if so. A name that resolves to nothing is rejected outright, with
 * `ComponentNotRegistered`/`MaterialNotRegistered`: registering or editing a
 * product must never mint a new `Component`/`Material` master row on the
 * spot, so only a name already registered in `components`/`materials` is
 * valid to use in a product's composition. The `QueryBus` is reused verbatim
 * (`components`'/`materials`' own name-validation, uniqueness, and lookup
 * logic apply for free; this factory reimplements none of it) — see
 * src/modules/products/CLAUDE.md for the full reasoning and the narrow
 * dependency-cruiser exception this relies on.
```

After:

```ts
 * **Name resolution.** For every component/material name that isn't reused
 * verbatim from the product's own current composition (i.e. every entry
 * `createComponentLines` handles, and every id-less new entry
 * `reconcileComponentLines` handles), this factory asks
 * `ComponentRepository.findByName`/`MaterialRepository.findByName` whether a
 * `Component`/`Material` with that exact name already exists **globally** —
 * "Copper", "Core", "Jacket" are raw-material/component vocabulary real
 * products legitimately share, not reinvent per product — and reuses its id
 * if so. A name that resolves to nothing is rejected outright, with
 * `ComponentNotRegistered`/`MaterialNotRegistered`: registering or editing a
 * product must never mint a new `Component`/`Material` on the spot, so only
 * a name already registered through `POST /components`/`POST /materials` is
 * valid to use in a product's composition. Materials, components and
 * products are one module, so the factory reads the two repositories
 * directly — see src/modules/products/CLAUDE.md.
```

**d. Class doc comment, de-duplication paragraph.** Replace the phrase
`reuses that material's id without a second
 * round-trip query.` with `reuses that material's id without a second
 * lookup.`. Only the last two words change, from "round-trip query" to "lookup"; rewrap the line if
Prettier asks.

**e. Constructor.** Before:

```ts
  constructor(private readonly queryBus: QueryBus) {}
```

After:

```ts
  constructor(
    private readonly componentRepository: ComponentRepository,
    private readonly materialRepository: MaterialRepository,
  ) {}
```

**f. `resolveComponentId`, with its comment.** Before:

```ts
  // Resolves a component name to a `components` master row's id: reuses one
  // already registered under this exact name — by this product or an
  // earlier, unrelated one. A name that resolves to nothing is rejected with
  // `ComponentNotRegistered` — this factory never registers a new component
  // on the caller's behalf. See the class doc comment's "Name resolution"
  // note.
  private async resolveComponentId(
    componentName: ComponentName,
  ): Promise<Identity> {
    const existing = await this.queryBus.execute<
      FindComponentByNameQuery,
      { id: string; name: string } | undefined
    >(new FindComponentByNameQuery(componentName));
    if (existing === undefined) {
      throw ComponentNotRegistered.withName(componentName.asString());
    }
    return Identity.fromString(existing.id);
  }
```

After:

```ts
  // Resolves a component name to the id of the `Component` already
  // registered under this exact name — by this product or an earlier,
  // unrelated one. A name that resolves to nothing is rejected with
  // `ComponentNotRegistered` — this factory never registers a new component
  // on the caller's behalf. See the class doc comment's "Name resolution"
  // note.
  private async resolveComponentId(
    componentName: ComponentName,
  ): Promise<Identity> {
    const existing = await this.componentRepository.findByName(componentName);
    if (existing === null) {
      throw ComponentNotRegistered.withName(componentName.asString());
    }
    return existing.id;
  }
```

**g. `createOrReuseMaterialLine`'s comment.** Before:

```ts
  // Reuses a material already registered earlier in this same registration
  // request (see the class doc comment) without a second round-trip query,
  // falling through to `createMaterialLine`'s own global lookup on a cache
  // miss.
```

After:

```ts
  // Reuses a material already resolved earlier in this same registration
  // request (see the class doc comment) without a second repository lookup,
  // falling through to `createMaterialLine`'s own global lookup on a cache
  // miss.
```

**h. `resolveMaterialId`, with its comment.** Before:

```ts
  // Resolves a material name to a `materials` master row's id: reuses one
  // already registered under this exact name — by this product or an
  // earlier, unrelated one. A name that resolves to nothing is rejected with
  // `MaterialNotRegistered` — this factory never registers a new material on
  // the caller's behalf. See the class doc comment's "Name resolution" note.
  // Shared by both `createMaterialLine` callers, so the global lookup
  // applies equally to registration's fresh materials and an edit's new
  // (id-less) ones.
  private async resolveMaterialId(
    materialName: MaterialName,
  ): Promise<Identity> {
    const existing = await this.queryBus.execute<
      FindMaterialByNameQuery,
      { id: string; name: string } | undefined
    >(new FindMaterialByNameQuery(materialName));
    if (existing === undefined) {
      throw MaterialNotRegistered.withName(materialName.asString());
    }
    return Identity.fromString(existing.id);
  }
```

After:

```ts
  // Resolves a material name to the id of the `Material` already registered
  // under this exact name — by this product or an earlier, unrelated one. A
  // name that resolves to nothing is rejected with `MaterialNotRegistered` —
  // this factory never registers a new material on the caller's behalf. See
  // the class doc comment's "Name resolution" note. Shared by both
  // `createMaterialLine` callers, so the global lookup applies equally to
  // registration's fresh materials and an edit's new (id-less) ones.
  private async resolveMaterialId(
    materialName: MaterialName,
  ): Promise<Identity> {
    const existing = await this.materialRepository.findByName(materialName);
    if (existing === null) {
      throw MaterialNotRegistered.withName(materialName.asString());
    }
    return existing.id;
  }
```

Everything else in the file stays as it is. In particular, the lines are still built from
`componentName.asString()`/`materialName.asString()`. Matching is exact, so that is the found
aggregate's name.

- [ ] **Step 6: Delete the orphaned queries and stubs, and shrink the queries barrel**

```bash
cd "$(git rev-parse --show-toplevel)/backend"
git rm -rq src/modules/products/application/queries/find-material-by-name \
           src/modules/products/application/queries/find-component-by-name \
           src/modules/products/application/support/stub-query-bus.ts \
           src/modules/products/application/support/stub-command-bus.ts
grep -rn "FindMaterialByName\|FindComponentByName\|StubQueryBus\|StubCommandBus\|stub-query-bus\|stub-command-bus" src/modules/products
```

Expected: every line the `grep` prints is in `application/queries/index.ts`: the two
`Find*ByNameHandler` imports and their two array entries, which the overwrite below removes. `boms` and `manufacturing-instructions` keep their own
`stub-query-bus.ts`; this step does not touch them.

Overwrite `backend/src/modules/products/application/queries/index.ts`:

```ts
import { GetProductHandler } from '@products/application/queries/get-product/get-product.handler';
import { ListComponentsHandler } from '@products/application/queries/list-components/list-components.handler';
import { ListMaterialsHandler } from '@products/application/queries/list-materials/list-materials.handler';
import { ListProductsHandler } from '@products/application/queries/list-products/list-products.handler';

export const QueryHandlers = [
  // materials
  ListMaterialsHandler,
  // components
  ListComponentsHandler,
  // products
  ListProductsHandler,
  GetProductHandler,
];
```

- [ ] **Step 7: Run the specs, then the full backend checks**

```bash
docker compose -f backend/docker-compose.yml run --rm --no-deps app \
  npx jest modules/products/application/service modules/products/application/commands/register-product modules/products/application/commands/edit-product
docker compose -f backend/docker-compose.yml run --rm --no-deps app npx tsc --noEmit -p tsconfig.json
make backend/run-unit-tests
make backend/lint-architecture
make backend/lint-swagger
make backend/lint
make backend/format
```

Expected: everything exits 0. The three suites pass, with 16 factory tests, 5 register tests and
11 edit tests. Overall, the suite count is Task 1's count minus 5:
- 1 dropped factory case;
- the 2 `FindMaterialByNameHandler` tests;
- the 2 `FindComponentByNameHandler` tests.

`lint-swagger` passing proves that `NestFactory.create(AppModule)` resolved the factory's two
repositories (Review Focus 5). If `make backend/lint` or `make backend/format` fails, run
`make backend/fix-lint` / `make backend/fix-format`, then re-run.

- [ ] **Step 8: Commit**

```bash
git add -A backend
git commit -m "wip: resolve product composition through the repositories"
```

---

### Task 3: Update the docs, the stale code comments and the ADR note

**Files:**
- Modify:
  - `backend/src/modules/products/CLAUDE.md`, rewritten in full
  - `backend/src/modules/audit-logging/CLAUDE.md`
  - `backend/src/modules/manufacturing-instructions/CLAUDE.md`
  - `backend/src/framework/CLAUDE.md:127`
  - `docs/adrs/0009-module-structure.md`, under `## Notes`
- Modify (comments only, no code):
  - `backend/src/modules/products/application/exceptions/component-not-registered.exception.ts`
  - `backend/src/modules/products/application/exceptions/material-not-registered.exception.ts`
  - `backend/src/modules/products/domain/value/product-component-line.vo.ts`
  - `backend/src/modules/products/domain/value/product-material-line.vo.ts`
  - `backend/src/modules/products/domain/product.aggregate.ts`
  - `backend/src/modules/products/infrastructure/persistence/product.repository.ts`
  - `backend/src/modules/products/application/commands/product-component.input.ts`
  - `backend/src/modules/products/infrastructure/http/controllers/product/product.controller.ts`.
    Only the `//` comment above `ComponentNotRegisteredResponse` changes. The `@ApiOperation`
    summary stays.

`backend/CLAUDE.md` names no old module, alias or class, so it does not change. Step 1 checks this.

**Interfaces:**
- Consumes: the names produced by Tasks 1–2.
- Produces: nothing in code.

- [ ] **Step 1: List the stale references**

```bash
grep -rnE "\`(materials|components)\` module|components/materials module|\`components\`/\`materials\`|their own modules|own modules' schema|FindMaterialByName|FindComponentByName|product-composition-factory-reuse-is-narrow|\`materials\`' \`MaterialRepository\`|\`components/\`, \`materials/\`|the other six|six source modules|across the six modules|six modules' events" \
  backend/CLAUDE.md backend/src --include=*.md --include=*.ts
```

Expected: hits in the files listed above, and none in `backend/CLAUDE.md`. The `@ApiOperation`
line in `product.controller.ts` ("…registered in components/materials") does not match these
patterns, and must not be edited.

- [ ] **Step 2: Rewrite the stale code comments**

```bash
cd "$(git rev-parse --show-toplevel)/backend/src/modules/products"
perl -pi -e 's/registered in the `components` module\./registered in the `component` table./' \
  application/exceptions/component-not-registered.exception.ts
perl -pi -e 's/registered in the `materials` module\./registered in the `material` table./' \
  application/exceptions/material-not-registered.exception.ts
perl -pi -e 's/^ \* `components` module before this product touched it/ * `component` table before this product touched it/' \
  domain/value/product-component-line.vo.ts
perl -pi -e 's/in the `materials` module before this product touched it/in the `material` table before this product touched it/' \
  domain/value/product-material-line.vo.ts
perl -pi -e 's/standalone aggregates owned by their own modules and outlive/standalone aggregates with their own lifecycle and outlive/' \
  domain/product.aggregate.ts
perl -pi -e 's/owned by their own modules \(see/with their own lifecycle (see/' \
  infrastructure/persistence/product.repository.ts
perl -pi -e 's{^// in the `components`/`materials` module: `ProductCompositionFactory` only$}{// as a `Component`/`Material`: `ProductCompositionFactory` only}' \
  infrastructure/http/controllers/product/product.controller.ts
git diff --stat .
```

Expected: 7 files changed, one line each.

Then, in `application/commands/product-component.input.ts`, replace:

```ts
// value objects: those belong to the components/materials modules and are
// constructed only inside `ProductCompositionFactory`, the one place this
// module is allowed to reach for them (see
// src/modules/products/CLAUDE.md).
```

with:

```ts
// value objects: they are constructed only inside `ProductCompositionFactory`,
// which validates each name and resolves it to an already-registered
// `Component`/`Material` (see src/modules/products/CLAUDE.md).
```

- [ ] **Step 3: Rewrite `products/CLAUDE.md`**

Overwrite `backend/src/modules/products/CLAUDE.md`:

````markdown
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
- **A material has an optional code** (`MaterialCode`). It is trimmed, a blank code means none
  (stored as `null`), and it is deliberately not unique.
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

`infrastructure/http/exception.mapper.ts` (`ProductsExceptionMapper`) maps all seven of this
module's exceptions. Their Problem Details are pinned by `exception.mapper.spec.ts` next to it.

- `MaterialNameAlreadyExists` / `ComponentNameAlreadyExists` — thrown when registering or renaming
  a material/component onto a name that is already taken. Both map to `409 Conflict`, with the name
  as `name`: the request conflicts with existing state.
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

`PrismaComponentRepository`/`PrismaMaterialRepository` pass `prisma.component`/`prisma.material`
directly as their `ModelDelegate`, but `PrismaProductRepository` cannot pass `prisma.product`:
- A product's aggregate spans three tables, so its delegate is a small hand-written adapter. It
  loads and saves the nested shape (`ProductRecord`) that `ProductMapper` expects.
- `Product.updateComponents()`'s doc comment says the previous composition is discarded in full,
  not merged. The delegate's `upsert` mirrors that literally: it deletes the product's existing
  `product_component` rows, which cascades to `product_material`, before recreating the
  composition the aggregate now holds.
````

- [ ] **Step 4: Update `audit-logging/CLAUDE.md`**

In `backend/src/modules/audit-logging/CLAUDE.md`, as the rename left it, make these edits. Rewrap
each paragraph to the file's ~100-column width:

- In the opening paragraph:
  - "every mutating event across the other six modules — `identity`, `products`, `components`,
    `materials`, `manufacturing-instructions`, `boms` —" → "every mutating event across the other
    four modules — `identity`, `products`, `manufacturing-instructions`, `boms` —".
- In "Why there's no `domain/` layer here":
  - "events the other six already emit" → "events the other four already emit".
- In "The one legitimate cross-module dependency":
  - "from one of the six source modules each" → "from one of the four source modules each".
  - "from `identity`, `products`, `components`, `materials`, `manufacturing-instructions` and
    `boms`." → "from `identity`, `products`, `manufacturing-instructions` and `boms`. Material and
    component events come from `products` (they were separate modules until ADR 0009), so their
    handlers live in `application/event-handlers/products/`."
  - In the parenthesised list of composition-factory carve-outs, delete
    "`ProductCompositionFactory`, ". The list keeps `ManufacturingInstructionCompositionFactory`,
    `BomCompositionFactory` and `GetProductDailyBomsHandler`.
- Above the event table: "Every mutating event across the six modules" → "Every mutating event
  across the four source modules".
- In "Resolving 'who did this'": "none of the six modules' events" → "none of the four source
  modules' events".
- Leave "across all six record types" alone: there are still six `recordType` values.

Check:

```bash
grep -n "six\|\`components\`\|\`materials\`\|ProductCompositionFactory" backend/src/modules/audit-logging/CLAUDE.md
```

Expected: only the "six record types" line.

- [ ] **Step 5: Update `manufacturing-instructions/CLAUDE.md` and `framework/CLAUDE.md`**

In `backend/src/modules/manufacturing-instructions/CLAUDE.md`:
- In the opening paragraph, change "the same vertical-slice layout as `products/`, `components/`,
  `materials/`" to "the same vertical-slice layout as `products/`", and rewrap.
- In the section on the read-side crossing into `products`, delete the whole sentence that starts
  "This is the read-side mirror of `products`' own write-side crossing into
  `components`/`materials`" and ends "— see `products/CLAUDE.md`)." `products` has no write-side
  crossing any more.

In `backend/src/framework/CLAUDE.md:127`, change "(see `materials`' `MaterialRepository`)" to
"(see `products`' `MaterialRepository`)".

- [ ] **Step 6: Add the ADR note**

Append to the `## Notes` list in `docs/adrs/0009-module-structure.md`:

```markdown
- `materials` and `components` are merged into `products`
  (`docs/superpowers/specs/2026-10-15-merge-materials-components-into-products-design.md`). Inside
  `products` they form one flat, layered tree: each concept keeps its own folders and file prefixes
  within `domain/`, `application/` and `infrastructure/`. That is how the merge applies
  Consequences' "own component directories", rather than as per-concept sub-trees. The
  product-composition carve-out is gone. Blocking the deletion of a material or component that a
  product still uses, and foreign keys between product rows and material/component rows, are still
  deferred: both deletes are allowed, and products keep their copied names.
```

- [ ] **Step 7: Verify and commit**

```bash
grep -rnE "\`(materials|components)\` module|components/materials module|their own modules|FindMaterialByName|FindComponentByName|product-composition-factory-reuse-is-narrow|\`materials\`' \`MaterialRepository\`|\`components/\`, \`materials/\`|the other six|six source modules|six modules' events" \
  backend/CLAUDE.md backend/src --include=*.md --include=*.ts
make backend/lint
make backend/format
```

Expected: the `grep` prints nothing, and both targets exit 0.

```bash
git add -A backend docs/adrs
git commit -m "wip: document the merged products module"
```

---

### Task 4: Prove behaviour is preserved, run the guardrails, squash

The orchestrator runs this task, not the sub-agent: the definition of done requires the
orchestrator to confirm it. Run every command from the repo root.

**Files:**
- Temporary only: `backend/tmp-old-schema/`, created and deleted within this task.

**Interfaces:**
- Consumes: Tasks 1–3 committed.
- Produces: one final commit on top of `RENAME_COMMIT`.

- [ ] **Step 1: Only this work sits on top of the rename**

```bash
RENAME_COMMIT=$(git log -1 --format=%h --grep='rename standard-boms module to manufacturing-instructions')
git log --oneline "$RENAME_COMMIT"..HEAD
```

Expected: exactly the three `wip:` commits from Tasks 1–3. If any other commit appears, stop and
ask: Step 7's squash would fold it into the refactor commit.

- [ ] **Step 2: The contract is unchanged**

```bash
make generate-swagger
git diff --exit-code "$RENAME_COMMIT" -- backend/docs/openapi.json backend/docs/openapi.yaml frontend/api
make lint-swagger
make lint-api-contract
```

Expected: `git diff` exits 0 with no output, and both lint targets pass.

- [ ] **Step 3: The database is unchanged**

```bash
ls backend/prisma/migrations | wc -l
git ls-tree --name-only "$RENAME_COMMIT" backend/prisma/migrations/ | wc -l
mkdir -p backend/tmp-old-schema
for f in $(git ls-tree --name-only "$RENAME_COMMIT" backend/prisma/schema/); do
  git show "$RENAME_COMMIT:$f" > "backend/tmp-old-schema/$(basename "$f")"
done
docker compose -f backend/docker-compose.yml run --rm --no-deps app \
  npx prisma migrate diff --from-schema tmp-old-schema --to-schema prisma/schema --script
rm -rf backend/tmp-old-schema
```

Expected: the two counts match, and the diff prints `-- This is an empty migration.` If Prisma 7
rejects the flags, run `npx prisma migrate diff --help` in the same container and use its
schema-to-schema flag names. The check must not connect to a database.

- [ ] **Step 4: The other projects are untouched, and no stale reference remains**

```bash
git diff --stat "$RENAME_COMMIT" -- frontend acceptance-tests
grep -rn "@materials/\|@components/\|MaterialsModule\|ComponentsModule\|MaterialsExceptionMapper\|ComponentsExceptionMapper\|FindMaterialByName\|FindComponentByName" backend/src
grep -rn "src/modules/materials\|src/modules/components\|product-composition-factory-reuse-is-narrow\|StubCommandBus" \
  backend/src backend/CLAUDE.md backend/.dependency-cruiser.cjs backend/prisma backend/tsconfig.json backend/package.json
test ! -e backend/src/modules/materials && test ! -e backend/src/modules/components && echo gone
```

Expected:
- The `git diff` and both `grep` commands print nothing.
- The last command prints `gone`.

The first `grep` is spec §6.6 verbatim. The second also catches paths and rule names in docs and
config.

- [ ] **Step 5: Run the full guardrails on fresh containers, detached**

```bash
make backend/down
setsid nohup sh -c 'make run-guardrails; echo "GUARDRAILS EXIT=$?"' > /tmp/guardrails-merge-products.log 2>&1 &
```

The containers are recreated so that no stale `node_modules` volume survives. The run is detached
because the acceptance suite outlives a session restart. Monitor `/tmp/guardrails-merge-products.log`
until it ends with a `GUARDRAILS EXIT=` line.

Expected:
- `GUARDRAILS EXIT=0`, with all nine checks green.
- `lint-architecture` passes with one carve-out fewer.
- `run-unit-tests` passes.
- `run-acceptance-tests` passes, including the `registring-material`, `registring-component`,
  `registring-product` and `viewing-audit-log` scenarios.
- `git status --short acceptance-tests frontend` prints nothing afterwards.

- [ ] **Step 6: Re-read the Review Focus**

For each of the five Review Focus lines, confirm that its pinning check ran green in Steps 2–5 or
in Tasks 1–2's runs:
1. `exception.mapper.spec.ts`
2. the swagger diff
3. `event-handlers/index.spec.ts`
4. the factory's not-registered cases
5. `lint-swagger` and `registring-product`

- [ ] **Step 7: Squash into the single refactor commit**

```bash
git reset --soft "$RENAME_COMMIT"
git commit -m "refactor(backend): merge materials and components into products

Folds the materials and components modules into products (ADR 0009):
every file moves with git mv into the same layer folder, and the
barrels, exception mappers, Nest modules and Prisma schema files are
merged. ProductCompositionFactory now resolves component and material
names through ComponentRepository/MaterialRepository.findByName instead
of the QueryBus, so FindMaterialByName/FindComponentByName and the
product-composition dependency-cruiser carve-out are deleted. Routes,
DTOs, problem types, tables, domain events and audit recordTypes are
unchanged. A new exception-mapper spec pins the seven Problem Details
across the merge.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git log --oneline -3
```

Expected: the rename commit followed by exactly one new commit.
