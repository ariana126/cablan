# Daily BOM preview — plan

Design: `docs/superpowers/specs/2026-10-22-daily-bom-preview-design.md`.

## Contract

`GET /api/boms/{id}/weight-differences` → `200`

```json
{ "lines": [ { "componentId": "…", "componentName": "مغزی", "materialId": "…",
  "materialName": "مسی", "actualWeight": 3, "standardWeight": 2, "difference": 1 } ] }
```

`404` — the existing BOM-not-found problem type. Auth as `GET /api/boms/{id}`.

## Backend
1. Query + handler returning the lines for one daily BOM, reusing the dashboard's line
   computation (difference rounded the same way).
2. Controller route, response DTO, Swagger, regenerated spec; unit tests.

## Frontend
1. `make sync-api-contract` (orchestrator); gateway method on the BOMs gateway.
2. `BomPreviewDialog` in `features/boms/` using `app-weight-difference`; تایید / ویرایش.
3. BOMs page: open the preview after a successful register; ویرایش opens the existing edit
   dialog for the BOM. Specs; a11y stub for the dialog.

## QA
1. Step definitions and tasks for the four new scenarios in `registring-bom.feature`.
2. Locators by role and accessible name: the dialog (role `dialog`, name «پیش‌نمایش آنالیز
   روزانه»), buttons «تایید» and «ویرایش», the table «اختلاف وزن مواد اولیه».
