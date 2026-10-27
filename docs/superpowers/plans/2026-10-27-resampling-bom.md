# Re-sampling a rejected daily BOM — plan

Design: `docs/superpowers/specs/2026-10-27-resampling-bom-design.md`. Feature:
`acceptance-tests/specs/bom-analyzing/resampling-bom.feature`.

## Contract (pinned)

- `POST /api/boms/:id/resampling` — roles QcInspector, Management, SystemAdmin.
  Request `{ "components": [{ "componentId": string, "materialId": string, "weight": number }], "description"?: string }`.
  201 `{ "id": string }`. 400 validation (as `POST /boms`), 403, 404, 409 problem type
  `bom-not-resamplable`.
- `BomReportRow` (items of `POST /boms/report`) and `GET /boms/:id`: new `resamplable: boolean`.

## QA (acceptance-tests)

1. Step definitions in `step-definitions/bom-analyzing/resampling-bom.steps.ts`; reuse existing
   Background steps (standard BOM, rejection precondition, login); add the new
   «… با شماره سفارش … و شماره ردیابی … برای کد MI … » precondition if absent.
2. Domain tasks: `ResampleDailyBom.using` (UI: row's «نمونه گیری مجدد» on `/boms`, fill weights,
   submit) and `.viaApiUsing`; questions on the `/boms` list for which rows offer the button;
   `Then`s via `POST boms/report` filtered by tracking number.
3. Lean Page Object additions on `screenplay/ui/boms-page.ts` (button, disabled header fields).

## Backend (boms module)

1. Application: `ResampleBomCommand { sourceBomId, components, description?, registeredBy }`,
   `ResampleBomHandler`; application exception `BomNotResamplable` → 409 `bom-not-resamplable`;
   repository port method to find whether a later BOM exists for a tracking number.
2. Read side: `resamplable` on report row and detail, computed in SQL/repository.
3. Infrastructure: controller route, `ResampleBomDto`, exception mapping, Prisma repository,
   OpenAPI regenerated.

## Frontend

1. `make sync-api-contract` (orchestrator), gateway method `resample(id, body)`.
2. `/boms` actions column button, form dialog resample mode (locked header fields), list reload.
3. Specs; a11y route unchanged (no new route) — dialog markup must keep labels.
