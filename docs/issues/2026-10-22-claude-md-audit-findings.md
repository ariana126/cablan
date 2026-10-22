# Code issues found during the CLAUDE.md audit — 2026-10-22

Found while verifying every CLAUDE.md file against the code. None has been fixed; each was
observed by reading the source and is **not yet reproduced** by a test or a running stack. The
docs now describe the current behaviour, so fixing one of these means updating the owning
project's CLAUDE.md too.

## Bugs

### Backend

1. **`make prod-up` cannot start the image.** `backend/Makefile` `prod-up` forwards only
   `DATABASE_URL` and `JWT_SECRET`, but `DefaultAdminSeeder` reads `DEFAULT_ADMIN_USERNAME` /
   `DEFAULT_ADMIN_PASSWORD` with `getOrThrow` right after `listen()`, so the container should exit
   on boot. Fix: forward both keys (`-e DEFAULT_ADMIN_USERNAME -e DEFAULT_ADMIN_PASSWORD`) and
   name them in the target's help text.
2. **Renaming a manufacturing-instruction code orphans the daily BOMs cloned from it.** A daily
   BOM keeps the MI code it was cloned from; after a rename, `GetProductDailyBomsHandler` gets a
   404 looking it up and fails the whole product's dashboard row, and editing that BOM's
   composition fails with 400 `BomStandardBomNotFound`.
3. **The BOM dashboard reads another module's table.** `PrismaBomDashboardRepository`
   (`backend/src/modules/boms/infrastructure/persistence/bom-dashboard.repository.ts`) queries
   `prisma.manufacturingInstruction` (`standard_bom`), which belongs to
   `manufacturing-instructions`. ADR 0004 says modules own their data; dependency-cruiser cannot
   see it because it is a Prisma model access, not a TypeScript import.
4. **Uniqueness races surface as 500.** A duplicate username (partial unique index) or `mi_code`
   that slips past the handler's pre-check hits the database constraint and is not translated
   into the domain's 409 — unlike material codes, which are.
5. **A whitespace-only username is a 500.** The DTO validates only `@IsNotEmpty`.
6. **An admin editing themselves gets a 409 whenever `role` is in the body**, even when it equals
   their current role: `CannotChangeOwnRole` fires on the presence of the field, not on a change.
   Clients must omit it.

### Acceptance tests

7. **`API_BASE_URL` falls back to the dev stack.** `acceptance-tests/support/config.ts` defaults
   to `http://localhost:3000/api` (dev); `.env.example` sets `:3001` (test). Without the env var
   the suite would truncate the developer's dev database. The `APP_BASE_URL` fallback already
   points at the test stack (`:4201`); this one should match (`:3001`).

## Cleanup

### Dead code

- `acceptance-tests/screenplay/ui/users-page.ts` — imported by nothing.
- `ManufacturingInstructionReportRepository.findDetailById`
  (`backend/src/modules/manufacturing-instructions/…/manufacturing-instruction-report.repository.ts`)
  — no caller outside a spec stub.

### Stale code comments

- `backend/.dependency-cruiser.cjs` header says `make npm depcruise` (the target is
  `make lint-architecture`); its `modules-isolated` rule and `identity.module.ts` say
  cross-module traffic "goes over HTTP" (it goes over the `QueryBus` and framework ports).
- `ReportManufacturingInstructionsQuery` says "zero-based" paging and "empty array means no
  filter"; paging is 1-based and `[]` is a filter.
- `backend/…/list-audit-log.dto.ts` calls `endOfCalendarDayExclusive` a method; it is a
  module-level function.
- `acceptance-tests/support/hooks.ts` (~L15) — "nine of the examples drive a browser", "the
  identity chunk".
- `acceptance-tests/screenplay/common/report-context.ts` (~L15-20) — says the standard-BOM
  background is still pending; it is implemented.
- `acceptance-tests/screenplay/ui/standard-bom-reports-page.ts` (~L5) — names a
  `/standard-boms/report` route the frontend does not have.
- `acceptance-tests/screenplay/common/downloads.ts` — says `bom-report-export.ts` is its only
  caller; `standard-bom-report-export.ts` uses it too.
- `frontend/a11y/accessibility.spec.ts` (~L178-182) — "the one call each page makes" / "Both
  endpoints"; it now stubs every API call the audited pages make.
