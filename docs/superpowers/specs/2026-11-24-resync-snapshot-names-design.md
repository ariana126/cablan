# One-time resync of material name copies — design

## Intent

Products, standard BOMs (manufacturing instructions) and daily BOMs keep their own copy of
the name of every material and component in their composition, taken when they were saved.
Before the in-use lock (issue #94) and the System Admin correction (issue #110), materials
and components were renamed in production (by hand and by material imports) without those
copies following. So these records still show the old names. Since #110, a correction updates
every copy, so new drift can't happen. This change catches up the old drift, once.

## Goals

- Every copy of a material name matches that material's current name.
- Applied once, automatically, on every environment (dev, staging, production) when the
  change is deployed.

## Non-goals

- No ongoing sync, no new endpoint or UI. The #110 propagators already cover new renames.
- Component-name copies (the product owner asked for materials only), product-name copies
  (in standard BOMs and orders), material codes (never copied), and anything else not named
  above.

## Anti-goals

- Touching a copy whose material **no longer exists**. It has no current name to
  copy, so it keeps the name it has.
- Changing anything other than the `name` column of a stale copy. No ids, positions, weights,
  reviews or history change, and no rows are added or removed.

## Constraints

- Records-in-use rule (root `CLAUDE.md`): history is never deleted. This only rewrites names,
  which is the same rewrite the System Admin correction already does.
- Migrations are generated or guarded (`backend/prisma/migrations/**`): only the
  backend-engineer creates the migration, through the project's own tooling.

## Approaches

- **A. One data migration (chosen).** A Prisma SQL migration that copies the current name into
  every stale copy. It runs exactly once per database, follows the existing pattern
  (`normalise_persian_digits`, `order_backfill`), and needs no code that stays in the app.
  Trade-off: no audit-log entry. That is acceptable because this repairs pre-rule leftovers
  rather than recording something a person did.
- B. A System Admin "resync names" action: auditable, but a permanent endpoint, screen and
  tests for a one-off. Rejected.
- C. Hand-run SQL on production: unreviewed and untested, and staging would need the same
  done separately. Rejected.

## The design

One migration, `UPDATE … FROM material WHERE copy.name IS DISTINCT FROM material.name`, over
three copy tables:

| Copy table | Joined on | Source |
|---|---|---|
| `product_material` | `material_id` | `material.name` |
| `bom_material` | `material_id` | `material.name` |
| `standard_bom_material` (`ManufacturingInstructionMaterial`) | `material_id` | `material.name` |

The inner join already skips copies whose material is gone. The update is idempotent:
running it again changes nothing.

## Left to the builder

- Confirm the actual table names in `backend/prisma/schema/` (the MI table maps to
  `standard_bom_material`).
- How to prove it: an integration test that seeds stale copies, plus one whose material is
  missing, runs the migration's SQL, and checks the result. Re-running it should change
  nothing. Whether that needs a testing hook like `order_backfill`'s is the builder's call.
- No acceptance-test (Gherkin) change: there's no user-visible behaviour, only data repair.
