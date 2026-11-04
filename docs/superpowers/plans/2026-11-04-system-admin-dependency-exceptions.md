# System Admin exceptions to the dependency policy — plan

Issue #110. Design: `docs/superpowers/specs/2026-11-04-system-admin-dependency-exceptions-design.md`.

## Pinned HTTP contract

| Route | Roles | Body | Success | Problems |
|---|---|---|---|---|
| `PATCH /materials/:id` | as today | today's + `applyToRelatedRecords?: boolean` | 204 | 409 `record-has-dependents` (no flag / not admin / non-correctable field changed), 409 `material-code-taken` / name-taken as today |
| `PATCH /products/:id` | as today | + `applyToRelatedRecords?: boolean` | 204 | same pattern |
| `PATCH /components/:id` | as today | + `applyToRelatedRecords?: boolean` | 204 | same pattern |
| `PATCH /equipment/:id` | planner | `{ name, applyToRelatedRecords?: boolean }` | 204 | 409 `record-has-dependents`, `equipment-name-taken`; admin+flag skips `equipment-retired` |
| `PATCH /maintenance-activities/:id` | planner | `{ name, specialty, applyToRelatedRecords?: boolean }` | 204 | 409 `record-has-dependents` (also when the specialty changed), `maintenance-activity-name-taken` |
| `DELETE /equipment/:id/pm-plan-items/:itemId/executions/:executionId` | SystemAdmin | — | 204 | 404 |
| `DELETE /equipment/:id/pm-plan-items/:itemId/executions` | SystemAdmin | — | 204 | 404 |
| `DELETE /equipment/:id/pm-plan-items/:itemId` | SystemAdmin | — | 204 | 404, 409 `pm-plan-item-active` |
| `DELETE /equipment/:id` | SystemAdmin | — | 204 | 404, 409 `equipment-not-retired` |
| `POST /equipment/:id/reactivation` | SystemAdmin | `{ rescheduledItems?: { planItemId: string; firstDueDate: string }[] }` | 204 | 404, 409 `equipment-not-retired`, 400 `invalid-reactivation-item`, 400 `reactivation-first-due-date-in-past`, 400 `validation-error` |

Read-model additions: `GET /equipment/:id/maintenance-history` rows gain `id` (execution id) and
`planItemId`. `GET /equipment` / `GET /equipment/:id` keep `retired` (now: last service break open).
Every other read just stops showing deleted data and gap occurrences.

Persian `detail`s:
- `pm-plan-item-active`: «برای حذف ردیف فعال، ابتدا آن را غیرفعال کنید.»
- `equipment-not-retired`: «فقط تجهیز کنار گذاشته شده قابل حذف یا فعال سازی دوباره است.»
- `invalid-reactivation-item`: «ردیف انتخاب شده در برنامه فعال این تجهیز نیست.»
- `reactivation-first-due-date-in-past`: «اولین موعد تازه نمی تواند پیش از روز فعال سازی باشد.»

Audit (recordType / action → UI label): `MaintenanceExecution`/`Deleted` «حذف سابقه انجام»;
`PmPlanItem`/`Deleted` «حذف ردیف غیرفعال برنامه»; `Equipment`/`Deleted` «حذف تجهیز»;
`Equipment`/`Reactivated` (new action) «فعال سازی دوباره تجهیز». A correction is the record's
ordinary `Edited` entry with one line per changed field (`name`, `code`).

## Tasks

### QA (`acceptance-tests/`)
1. Automate every new scenario of the nine feature files (design, "Scenarios"), and re-check the
   removed System Admin equipment scenario's steps are not orphaned.
2. The admin confirmation steps: "… و اعمال آن … را تایید می کند" → edit + confirm (UI: the
   confirmation dialog's «تایید»; API: `applyToRelatedRecords: true`); "… اما … تایید نمی کند" →
   the dialog cancelled (API equivalent: the edit without the flag, refused, nothing changed).
3. Setups for retirement/reactivation on given dates via the test clock; deletions via the new
   routes.
4. Audit-log label mapping for the four new actions above.

### Backend (`backend/`)
1. `framework/`: `CorrectionPropagator` port + registration beside `DependentsProbe`;
   `RecordDependencies.propagateCorrection()`; unit specs.
2. Products/MI/boms/maintenance: propagators for their snapshot columns; edit handlers accept
   `applyToRelatedRecords` (SystemAdmin only, correctable fields only), run in a `UnitOfWork`.
3. Maintenance domain: service breaks on `Equipment` (`retire`, `reactivate(today, rescheduled)`),
   gap exclusion in `PmOccurrences`/`PmSchedule` (restart segment), `deleteExecution(s)`,
   `deletePlanItem`, `delete` of retired equipment; new events; exceptions + mapper entries;
   migration of `retired_at` into service breaks.
4. New routes (table above), OpenAPI regenerated; history rows `id`, `planItemId`.
5. Audit-logging: handlers for `MaintenanceExecutionDeleted`, `PmPlanItemDeleted`,
   `EquipmentDeleted`, `EquipmentReactivated`; new `Reactivated` action.
6. Integration tests: propagation across modules in one transaction (and rollback on a uniqueness
   clash), cascade deletes, service breaks round trip.

### Frontend (`frontend/`)
1. Confirmation dialog on the five edit dialogs for SystemAdmin (design "UI scope").
2. History row delete, row "delete all executions", inactive row delete, retired equipment delete,
   reactivation dialog with per-row choice and Jalali date (min today).
3. Audit-log labels for the new action `Reactivated` and the new deleted record types.
4. Problems shown inside the open dialog; a11y routes unchanged unless a new route is added.
