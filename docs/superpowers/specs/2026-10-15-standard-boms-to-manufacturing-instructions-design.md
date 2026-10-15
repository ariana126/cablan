# Design: rename the `standard-boms` module to `manufacturing-instructions`

- **Date:** 2026-10-15
- **Implements:** [ADR 0009](../../adrs/0009-module-structure.md), first of three refactorings
  (this one, then merging `materials` + `components` into `products`, then
  [ADR 0007](../../adrs/0007-transactional-audit-trail.md))
- **Kind:** Behaviour-preserving refactoring, backend only

## Goal

The backend module that holds standard analyses becomes `manufacturing-instructions`, and its
code speaks the language of Manufacturing Instructions (MI). Today's standard BOM already has a
unique MI code, so each one is effectively an MI. Renaming the aggregate is therefore accurate,
not cosmetic.

Nothing a client, a stored row, or a user can see changes.

## Guiding rule

Rename everything inside the backend **except** names that form the public API contract or are
stored as data. Those keep their current names. They will be renamed later, together with the
routes, as part of the MI feature work.

## 1. What is renamed

**Module and wiring**

- `backend/src/modules/standard-boms/` → `backend/src/modules/manufacturing-instructions/`, moved
  with `git mv` so that history follows the files.
- The path alias `@standard-boms/*` → `@manufacturing-instructions/*`, in `backend/tsconfig.json`
  and in the Jest `moduleNameMapper` in `backend/package.json`.
- The imports in `backend/src/app.module.ts` and
  `backend/src/framework/infrastructure/http/exception.filter.ts`.

**Identifiers, using `StandardBom` → `ManufacturingInstruction` and `standard-bom` →
`manufacturing-instruction` in identifiers and file names**

| Layer | Renamed |
|---|---|
| Domain | The `StandardBom` aggregate, the `StandardBomRepository` port, `standard-bom.snapshot.ts`, the events `StandardBomRegistered/Edited/Deleted`, `StandardBomComponentLine` and `StandardBomMaterialLine` |
| Application | The commands `Register/Edit/DeleteStandardBom*` and their handlers. The queries and read models `ListStandardBoms*`, `GetStandardBomDetail*`, `GetStandardBomByMiCode*`, `ReportStandardBoms*`, `ExportStandardBoms*`, `StandardBomFilterOptions*`, `StandardBomReadModel`, `StandardBomDetail`, `StandardBomReportItem/Page` and `StandardBomExport*` read models. The five `StandardBom*` exceptions. `StandardBomCompositionFactory`, the `StandardBomReportRepository` port, and the in-memory fakes |
| Infrastructure | `StandardBomsModule` → `ManufacturingInstructionsModule`. `StandardBomsExceptionMapper`. `PrismaStandardBomRepository` and `PrismaStandardBomReportRepository`. `standard-bom.mapper.ts` |
| Prisma | `standard-boms.prisma` → `manufacturing-instructions.prisma`. The models become `ManufacturingInstruction`, `ManufacturingInstructionComponent` and `ManufacturingInstructionMaterial`, with relation and foreign-key fields renamed to match |

`MiCode`, `Brand`, `StandardLength` and `Weight` keep their names; they are already domain
language.

**Consuming modules: forced changes only**

- `boms` updates only its imports of the renamed queries and read models (`BomCompositionFactory`,
  `GetProductDailyBomsHandler`).
- `audit-logging` updates its event imports. Its handler folder `event-handlers/standard-boms/`
  becomes `event-handlers/manufacturing-instructions/`, and the handler classes are renamed to
  match.

**Architecture lint (`backend/.dependency-cruiser.cjs`)**

- Every path that names `standard-boms/…` follows the move.
- The rule `standard-bom-composition-factory-reuse-is-narrow` →
  `manufacturing-instruction-composition-factory-reuse-is-narrow`.
- The allow-lists in the `BomCompositionFactory` and `GetProductDailyBomsHandler` rules, and the
  module list in the audit rule, use the new paths.
- The rules allow and forbid exactly the same imports as before.

**Docs**

- The module's `CLAUDE.md` moves with it and is rewritten to the new names, including a short note
  on which names are kept and why.
- References in the `boms`, `audit-logging` and `products` `CLAUDE.md` files are updated.
- ADR 0009's Notes record that the API, UI and stored-data names are deferred.

## 2. What deliberately stays

| Kept | Reason |
|---|---|
| `StandardBomController`, with `@Controller('standard-boms')` and `@ApiTags('Standard BOMs')` | Routes, operationIds (`StandardBomController_*`) and the orval-generated `StandardBomsService` are built from these |
| Every request DTO class (`RegisterStandardBom{,Component,Material}Dto`, `UpdateStandardBomDto`, `ReportStandardBomsDto`, `StandardBomReportFiltersDto`, `ExportStandardBomsDto`) | Their class names are the OpenAPI schema names |
| `StandardBomExportFormat` (`infrastructure/spreadsheet/standard-bom-export-grid.ts`) and that file's name | Its name appears in OpenAPI as a schema |
| Problem-type URIs and titles (`standard-bom-mi-code-already-exists`, …) | API contract. They are string literals in the exception mapper, so renaming the exception classes leaves them unchanged |
| All tables, columns, constraints and indexes (`standard_bom*`, `bom.standard_bom_id`, `bom.standard_bom_mi_code`). Every `@@map` and `@map` is kept or added; no new migration | Stored data |
| `AuditRecordType.StandardBom = 'StandardBom'` | Stored in `audit_log_entry.record_type` and exposed as an API enum and filter value |
| `Bom`'s own `standardBomId` / `standardBomMiCode`, `BomStandardBomNotFound`, and the `bom-standard-bom-not-found` problem type | Forced changes only. This also keeps the field names stored in audit entries stable |
| Exception and log **message texts** | Exception messages flow into Problem Details `detail`, which is observable behaviour |
| Everything under `frontend/` and `acceptance-tests/`, plus `docs/retros/` | Out of scope, or historical record |

If any other name turns out to reach the OpenAPI spec, it is kept too. `make lint-swagger` decides.

## 3. How behaviour preservation is proven

All of the following must hold:

1. **The contract is unchanged.** `make generate-swagger` produces no diff in
   `backend/docs/openapi.json` or `backend/docs/openapi.yaml`, and `make lint-swagger` and
   `make lint-api-contract` pass.
2. **The database is unchanged.** No folder is added under `backend/prisma/migrations/`, and
   `prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema` reports no
   difference. The diff runs against a shadow database inside the backend container.
3. **The other projects are untouched.** `git diff --stat` shows no path under `frontend/` or
   `acceptance-tests/`.
4. **All tests and guardrails pass.** `make run-guardrails` is fully green, which includes:
   - backend unit tests, renamed along with their subjects but with unchanged assertions;
   - `lint-architecture`;
   - the unchanged acceptance suite, which is the behavioural proof.
5. **No stray old names remain.** `grep -rn "StandardBom\|standard-bom\|standardBom" backend/src`
   matches only the items kept in section 2.

## 4. Delivery

- **Who:** one `backend-engineer` dispatch, which reads `backend/CLAUDE.md` first. The orchestrator
  verifies criteria 1–5 itself before accepting the work.
- **Branch:** `refactor/manufacturing-instructions-module`.
- **Commit:** one refactoring commit,
  `refactor(backend): rename standard-boms module to manufacturing-instructions`.

## Out of scope

- Renaming routes, DTOs, problem types, the frontend or the acceptance tests.
- Data migrations, including of audit `recordType` values.
- Persian UI copy.
- Any new MI content (build steps, factory labels, revisions).
- The other two refactorings, each of which gets its own spec.
