# Resync material name copies — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A one-time data migration that rewrites every stale copy of a material's name in
products, standard BOMs and daily BOMs to that material's current name.

**Architecture:** One Prisma data migration (SQL only, no schema change) in `backend/`, plus a
Postgres integration test that re-runs the migration's SQL, following the precedent of
`test/integration/persian-digit-normalisation.int-spec.ts`. Owner: `backend-engineer`.

**Tech Stack:** Prisma migrations, Postgres, Jest integration suite (`make run-integration-tests`).

**Spec:** `docs/superpowers/specs/2026-11-24-resync-snapshot-names-design.md`

## Global Constraints

- Copies of **material names only**: `product_material.name`, `bom_material.name`,
  `standard_bom_material.name`. Component names, product names and codes are out of scope.
- A copy whose `material_id` has no `material` row is left unchanged.
- Only the `name` column changes; no rows are added or removed, nothing else is rewritten.
- No audit entry is written, no domain event, no endpoint, no frontend or Gherkin change.
- The SQL is idempotent: running it again changes nothing.
- Migrations are created through `db:migration:create`; the guard hook blocks Write/Edit under
  `prisma/migrations/`, so the SQL goes in through the shell (`backend/CLAUDE.md`).

## Review Focus

- A copy pointing at a deleted material: must keep its old name, not become NULL or error.
- A copy already matching: untouched (the `IS DISTINCT FROM` guard), so a re-run is a no-op.
- The same material used in many products/BOMs: every copy is fixed, not just one.
- Rows unrelated to materials (component copies with a stale name): unchanged.
- The audit log: no rows added by the migration.

---

### Task 1: The `resync_material_name_copies` migration and its integration test

**Files:**
- Create (generated, then filled through the shell): `backend/prisma/migrations/<timestamp>_resync_material_name_copies/migration.sql`
- Create: `backend/test/integration/material-name-copies-resync.int-spec.ts`
- Modify: `backend/CLAUDE.md` (the integration-suite list, beside `persian-digit-normalisation.int-spec.ts`)

**Interfaces:**
- Consumes: nothing new. Existing tables `material`, `product_material`, `bom_material`,
  `standard_bom_material`.
- Produces: the migration directory whose name ends in `_resync_material_name_copies`; the test
  finds its SQL by that suffix.

- [ ] **Step 1: Write the failing integration test** `material-name-copies-resync.int-spec.ts`

Read the migration's SQL by its directory suffix, the way `persian-digit-normalisation.int-spec.ts`
does (throwing `'The resync_material_name_copies migration is missing'` if absent). Seed through
Prisma with fresh ids/unique names, delete own rows in `afterEach`. Cases:

  - `rewrites a product's, a standard BOM's and a daily BOM's copy to the material's current name`:
    a material named `M-new-<uuid>`; a product, a standard BOM and a daily BOM each with a
    material line for it whose `name` is `M-old-<uuid>`. After running the SQL, all three copies
    equal `M-new-<uuid>`.
  - `fixes every copy of a material used in several products`: two products using it, both stale →
    both rewritten.
  - `leaves a copy whose material no longer exists unchanged`: a `product_material` row with a
    random `material_id` and name `Gone-<uuid>` → still `Gone-<uuid>`.
  - `leaves component name copies alone`: the product's `product_component.name` seeded stale
    (`C-old-<uuid>`, component named differently) → still `C-old-<uuid>`.
  - `is idempotent and writes no audit entry`: run the SQL twice; after the second run every
    seeded copy still holds the same name as after the first, and the `audit_log` row count is the
    same before the first run and after the second.

- [ ] **Step 2: Run it to see it fail**

Run (from repo root): `make run-integration-tests`
Expected: FAIL with "The resync_material_name_copies migration is missing".

- [ ] **Step 3: Create the migration**

Generate an empty migration named `resync_material_name_copies` with the project's
`db:migration:create` script (no schema change, so the draft is empty), then write its SQL through
the shell, from inside the container as `backend/CLAUDE.md` describes. A header comment states
the why (pre-#94/#110 renames left stale copies; a deleted material's copy is left). Wrap the
three updates in **one `DO $$ BEGIN … END $$;` block**, as `normalise_persian_digits` does, so the
test can run the whole file through a single `$executeRawUnsafe` (a prepared statement takes one
statement only). One update per table, each of the form:

```sql
UPDATE "product_material" AS copy
SET "name" = m."name"
FROM "material" AS m
WHERE m."id" = copy."material_id"
  AND copy."name" IS DISTINCT FROM m."name";
```

…repeated for `"bom_material"` and `"standard_bom_material"`. Check those two tables' column for
the material id is `material_id` in `prisma/schema/` before writing.

- [ ] **Step 4: Run it to see it pass**

Run: `make run-integration-tests`
Expected: PASS, including the five new cases.

- [ ] **Step 5: Document and commit**

Add a `material-name-copies-resync.int-spec.ts` bullet to `backend/CLAUDE.md`'s integration list.
Commit migration, test and doc as `feat(products): resync material name copies once`.

---

### Task 2 (orchestrator): Guardrails

- [ ] Run the guardrails via the wip-branch CI dispatch (`CLAUDE.local.md`); all ten jobs green.
- [ ] Squash onto `main`, confirm commit messages with the user, clean up the wip branch.
