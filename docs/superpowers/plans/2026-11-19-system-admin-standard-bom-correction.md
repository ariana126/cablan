# System Admin correction of a standard BOM in use — plan

Design: `docs/superpowers/specs/2026-11-19-system-admin-standard-bom-correction-design.md`.
Issue #126. No new endpoint and no new request/response field.

## HTTP surface (unchanged shapes)

- `PATCH /api/standard-boms/:id` — existing `UpdateStandardBomDto` (`miCode?`, `brand?`,
  `standardLength?`, `description?`, `active?`, `components?: [{ componentId, materials:
  [{ materialId, weight }] }]` as today). New behaviour: System Admin on an in-use standard BOM →
  204 when MI code unchanged and composition pairs unchanged; otherwise 409
  `record-has-dependents` (`recordType`, `dependents: [{ kind, count, names }]`).
- `DELETE /api/standard-boms/:id` — unchanged (409 for everyone when in use).
- Reads (`GET /boms/:id`, report, export, dashboard, weight-differences) — unchanged shapes;
  `brand`/`standardLength` of earlier daily BOMs now reflect the correction.
- Audit log read — unchanged shape; the `StandardBom` `Edited` entry lists changed weights old/new.

## Tasks

### QA (`acceptance-tests/`)

1. Automate the new/changed scenarios in `registring-standard-bom.feature` (delete outlines now
   over مصطفی/یاشار; new System Admin rule; daily BOMs unchanged rule).
2. Automate the three new `bom-dashboard.feature` examples and the new `exporting-bom.feature`
   example. Weight corrections in Given steps can go over HTTP (`PATCH /standard-boms/:id` as
   یاشار); the UI-voiced When «یاشار <مورد> آنالیز استاندارد "MI-100" را اصلاح می کند» goes through
   the standard BOM edit dialog.

### Backend (`backend/`)

1. `EditManufacturingInstructionCommand` gains the caller's System-Admin-ness (resolved in the
   controller from the current role).
2. Handler: the exception as in design §1 (MI code unchanged + same pair set), else 409 as today.
3. A framework propagation port (widen `CorrectionPropagator` or a sibling) carrying
   `brand`/`standardLength`; `boms` implements it by raw SQL on `bom` (no `updated_at` bump, no
   events); called in the edit's transaction.
4. Verify/extend the `ManufacturingInstructionEdited` audit entry to carry per-weight old/new.
5. Verify daily BOM registration ignores `active`.
6. Unit specs; an integration case in `test/integration/` proving the propagation leaves the daily
   BOM's review, weights, edit history and `updated_at` untouched and writes no daily-BOM audit
   entry.
7. Regenerate swagger if anything on the wire changed (not expected).

### Frontend (`frontend/`)

1. Standard BOM edit dialog: a System Admin can save allowed corrections on an in-use standard BOM;
   409s shown with `recordHasDependentsMessage()` in the dialog (verify; change only if blocked).
2. Dashboard per-product list: the explanatory note about current-standard comparison vs recorded
   decision.
3. Specs and a11y pass.
