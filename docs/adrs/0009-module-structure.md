# 0009. Six flat modules, one per domain concept

- **Status:** Accepted
- **Date:** 2026-10-15
- **Supersedes:** [0008](0008-split-boms-by-responsibility.md)

## Context

New concepts are coming:

- **Manufacturing Instruction (MI).** It holds what today's standard analysis holds, plus the
  steps to build a product, factory labels, and so on.
- **Permission management** with dynamic roles and actions on resources.

The system serves three audiences:

- management works with the *definitions* (materials, components, products, MIs);
- the QC team works with *daily BOMs* every day, including the dashboard and exports;
- the CEO works with *administration* (users, roles and permissions, the audit log).

We considered grouping modules into one directory per audience, with modules nested inside, and
rejected it. The audiences describe who uses what. They are not a code boundary: identity, for
example, belongs to no single audience's directory. The audiences show up instead in the
frontend's navigation and in default permission sets.

The current seven modules are named after entities. Three of them (`materials`, `components`,
`products`) form one tightly coupled definition: a product is only valid if its components and
materials exist. That validation currently crosses module boundaries through the
`product-composition-factory-reuse-is-narrow` carve-out. *Fundamentals of Software Architecture*
(ch. 3, connascence) says to keep strong coupling **inside** a boundary and weak coupling
**across** boundaries. The current split does the opposite.

## Decision

We will organise the backend as six flat modules under `backend/src/modules/`, with no grouping
directories. Wherever possible we keep the existing module names, so most of the change is
merging and absorbing rather than renaming:

| Module | Responsibility | Replaces |
|---|---|---|
| `identity` | Users and authentication | `identity` (unchanged) |
| `access-control` | Dynamic roles and permissions (resource × action) | the fixed `Role` enum and `RolesGuard` |
| `audit-logging` | Recording every change and letting the CEO view it | `audit-logging` (unchanged) |
| `products` | Raw materials, components and products, including product composition | `products`, which absorbs `materials` and `components` |
| `manufacturing-instructions` | MI: standard analysis, build steps, factory labels | `standard-boms` |
| `boms` | Daily BOM capture, reporting, export and the daily dashboard | `boms` (unchanged) |

Dependencies point one way: `boms` → `manufacturing-instructions` → `products`.

- Each arrow is a narrow query carve-out, and data crosses it as a snapshot
  ([0004](0004-module-owned-data-and-snapshot-copies.md)).
- `products` depends on no business module, and `manufacturing-instructions` never depends
  on `boms`.
- No business module imports `identity`, `access-control` or `audit-logging`. They reach them only
  through ports in `framework/`:
  - *who is acting* (`ActorContext`, as today);
  - *may this actor perform this action on this resource*, which replaces `UserRoleProvider`.
- Only `audit-logging` may know other modules' domain-event shapes, as today.

Inside `boms`, capture, reporting and the dashboard are separate component directories. This keeps
the separation that [0008](0008-split-boms-by-responsibility.md) asked for, but without making them
separate modules. The dashboard reads MI standards through the same `boms` →
`manufacturing-instructions` carve-out that registration already needs.

## Consequences

- **Product composition becomes local to one module.** `products` can validate it, and
  block deleting a material or component a product still uses, without crossing a boundary. Its
  tables may use real foreign keys among themselves.
- **There are fewer carve-outs:**
  - the product-composition one disappears;
  - the two `boms` → standard-BOM carve-outs (registration and dashboard) become one, to
    `manufacturing-instructions`.
- **`products` is the largest definition module**, and its name now covers more than products.
  Materials and components must stay as their own component directories inside it, so it doesn't
  turn into a single dumping ground.
- **Separating identity from access control** means changing a user's role doesn't change identity
  code, and adding a permission doesn't change authentication.
- **The refactor is substantial:**
  - `materials` and `components` merged into `products`, and `standard-boms` absorbed into the
    new `manufacturing-instructions`;
  - a new `access-control` module;
  - Prisma schema files merged and added to match;
  - migration of the fixed roles into dynamic role data, with a non-deletable super-admin role so
    the CEO cannot lock themselves out;
  - new dependency-cruiser rules.

  HTTP routes can stay the same apart from new endpoints for MI and access control, so the
  frontend's generated client changes only where features are added.
- **Still open:** how MI revisions work and how fine-grained permissions are. Separate ADRs for
  MI and access control will settle these.

## Compliance

- `.dependency-cruiser.cjs`:
  - one `modules-isolated` rule over the six modules;
  - carve-outs only for `boms` → `manufacturing-instructions`,
    `manufacturing-instructions` → `products`, and `audit-logging` → `*/domain/events`;
  - a rule forbidding any import of `access-control` or `identity` outside `framework/` bindings.
- `backend/prisma/schema/` has one file per module.

## Notes

- The product owner chose to keep the existing module names wherever possible. `identity`, `boms`
  and `audit-logging` are unchanged, and `products` keeps its name after the merge.
- The module names and the merge of materials, components and products were chosen by the
  product owner on 2026-10-15.
- Accepted on 2026-10-15.
- `standard-boms` → `manufacturing-instructions` is done inside the backend only. Routes, DTOs,
  problem types, tables, the audit `recordType` `'StandardBom'`, the frontend and the acceptance
  tests keep "standard BOM" names until the MI feature work renames them together. See
  `docs/superpowers/specs/2026-10-15-standard-boms-to-manufacturing-instructions-design.md`.
