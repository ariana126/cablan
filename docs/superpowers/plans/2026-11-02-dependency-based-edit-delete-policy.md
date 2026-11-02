# Dependency-based edit and delete policy — plan

Design: `docs/superpowers/specs/2026-11-02-dependency-based-edit-delete-policy-design.md`.

## Contract (pinned — QA and backend build against it in parallel)

Every refused edit/delete answers **409**, `application/problem+json`:

```json
{
  "type": "…/record-has-dependents",
  "title": "Record has dependents",
  "status": 409,
  "detail": "<English, informative>",
  "recordType": "Material | Component | Product | StandardBom | Bom | Equipment | MaintenanceActivity",
  "dependents": [{ "kind": "product | standard-bom | daily-bom | resampled-daily-bom | equipment-pm-plan", "count": 1, "names": ["کابل NYY"] }]
}
```

No request body changes. Response bodies of existing endpoints are unchanged, except that
`GET /boms/:id` / report items **may** gain nothing — the re-sample link is internal.

## QA (`acceptance-tests/`)

1. Automate every new scenario of the eight feature files (list in the design).
2. "به او گفته شود که X در N <kind> "<name>" استفاده شده است": API door → assert the 409 problem's
   `dependents` contains `{ kind, count: N, names ∋ name }`; UI door → assert the rendered
   message contains the count, the Persian kind label and the name.
3. "ویرایش نشده / حذف نشده" → read back through the API.
4. Fix existing automation whose setup now trips the rule (reorder setup), never weaken the rule.

## Backend (`backend/`)

1. `framework/`: `ReferencedRecordType`, `RecordReference`, `RecordDependent`
   (`kind`, `count`, `names`), `DependentsProbe` port + registration, `RecordDependencies`
   service with `assertNoDependents(ref)`, `RecordHasDependents` exception, mapping to 409
   `record-has-dependents` in the framework filter, OpenAPI schema for the problem.
2. One probe per referencing module (products, manufacturing-instructions, boms, maintenance)
   reading its own tables only.
3. Guard each handler in the design's lock table, before mutation.
4. `bom.resampled_from_id` column + migration; `Bom.resample()` sets it; persisted by the mapper.
5. Verify user history survives delete/role change (BOM registrar/editor/reviewer, execution
   performer); fix if any name is resolved live.
6. Unit tests per probe/handler, an integration test for at least one cross-module probe.
7. `make generate-swagger`.

## Frontend (`frontend/`)

1. Shared formatter: problem `record-has-dependents` → Persian message (labels in the design).
2. Wire it into the error handling of every edit/delete surface for materials, components,
   products (incl. composition edits), standard BOMs, daily BOMs (list, dashboard, preview),
   equipment rename, activity rename.
3. Specs for the formatter and one surface per feature area; a11y unchanged (no new route).

## Orchestrator

`make sync-api-contract` after the backend, CI run on a `wip/` branch, docs, commit, push.
