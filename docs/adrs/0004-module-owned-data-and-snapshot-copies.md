# 0004. One database, tables owned per module, snapshots copied across modules

- **Status:** Accepted
- **Date:** 2026-10-15

## Context

The domain references data across module boundaries:

- a product lists components and materials;
- a standard BOM belongs to a product;
- a daily BOM is recorded against a standard BOM's MI code.

A modular monolith ([0003](0003-modular-monolith.md)) can share one database. Even so, technical
coupling at the data level is what most often stops a monolith from evolving later, and the
book's advice (*Fundamentals of Software Architecture*, ch. 19) is to partition the data the same
way as the domain.

Auditability ([0002](0002-architecture-characteristics.md)) adds a further requirement. A QC record
must keep showing what was true **when it was recorded**. For example, if a material is renamed
later, an old daily BOM must still show the original name.

Options considered:

| Option | For | Against |
|---|---|---|
| Cross-module foreign keys and joins | Fewest columns. Referential integrity enforced by the database | Modules become coupled through the schema. A rename or delete in one module changes history in another. Splitting later is hard |
| Database per module | Strongest isolation | Several databases to run, which contradicts simplicity |
| **One database, tables owned per module, data copied in as snapshots** | Simple to run. Clear boundaries. History is immutable | Data is duplicated. A rename does not propagate. Referential integrity across modules is checked by application code, not the database |

## Decision

We will keep **one Postgres database**, and each table will be owned by exactly one module.

- Only the owning module's repositories read or write its tables.
- There are no foreign keys between modules. Foreign keys exist only from parent to child within
  one aggregate, with cascade delete.
- When an aggregate depends on another module's data, it **copies a snapshot** of the fields it
  needs at write time. Examples: `StandardBom.productName`, `Bom.miCode`, brand, product and
  length, `Bom.registeredBy`, and component and material names inside compositions.
- The other module is checked through a narrow query on the CQRS bus at write time. It is never
  joined at read time.

## Consequences

- A daily BOM shows exactly what the inspector recorded, even after master data changes, which
  supports auditability.
- Any module's tables could later move to their own schema or service without unpicking joins.
- Renaming master data does **not** update documents that already exist. This is intended, but
  users may be surprised. Reports filter on the snapshot values.
- Deleting master data that a document still references is not blocked by the database. If that
  must be prevented, the owning module has to check for it.
- Schema migrations (`backend/prisma/migrations`) stay in one place and run on boot through
  `prisma migrate deploy`.

## Compliance

- The Prisma schema is split into one file per module under `backend/prisma/schema/`. A
  `@relation` between models owned by different modules breaks this ADR and should be caught in
  review.
- `modules-isolated` in `.dependency-cruiser.cjs` stops a module from importing another module's
  persistence code.

## Notes

- Recorded retroactively.
- The composition factories (`ProductCompositionFactory`, `StandardBomCompositionFactory`,
  `BomCompositionFactory`) are where the snapshots are taken.
