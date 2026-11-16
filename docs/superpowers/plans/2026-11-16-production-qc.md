# Production QC — plan (issue #119)

Design: `docs/superpowers/specs/2026-11-16-production-qc-design.md`. Mode: auto. UI: full.

## Pinned HTTP contract

Role lists (`maintenance/domain/value/`): `QC_MANAGER_ROLES` = SystemAdmin, Management;
`QC_RECORDER_ROLES` = SystemAdmin, Management, QcInspector. Any other role → 403. Ids are uuids
(malformed → 400 `validation-error`). Times are ISO-8601 instants. Lists of names sort with
`byPersianName`.

### QC activity catalog — managers

| Route | Body / query | Response |
|---|---|---|
| `POST /qc-activities` | `{ name }` | 201 `{ id }` |
| `PATCH /qc-activities/:id` | `{ name, applyToRelatedRecords? }` | 204 |
| `DELETE /qc-activities/:id` | — | 204 |
| `GET /qc-activities` | — | `{ id, name, assignedEquipmentCount }[]` by name |

- `name` blank/whitespace → 400 `validation-error`, `errors[0].field = 'name'`; > 200 chars likewise.
- duplicate (trimmed, exact) → 409 `qc-activity-name-taken`.
- unknown id → 404 `qc-activity-not-found`.
- in use → 409 `record-has-dependents`, `recordType: 'qc-activity'`, `dependents` kinds
  `qc-assigned-equipment` (`count` = equipment, `names` = equipment names) and
  `qc-activity-execution` (`count` = records, `names: []`). The System Admin passes with
  `applyToRelatedRecords: true` on `PATCH` only (name correction); never on `DELETE`.

### QC equipment folder — managers

| Route | Body / query | Response |
|---|---|---|
| `GET /qc-equipment` | — | `{ id, name, retired, assignedActivityCount }[]` by name (retired included) |
| `GET /qc-equipment/:equipmentId` | — | `QcEquipmentReadModel` |
| `POST /qc-equipment/:equipmentId/activities` | `{ activityId }` | 201 (no body) |
| `DELETE /qc-equipment/:equipmentId/activities/:activityId` | — | 204 |

`QcEquipmentReadModel` = `{ id, name, retired, activities: QcActivityStatusReadModel[] }`;
`QcActivityStatusReadModel` = `{ activityId, activityName, lastPerformedAt: string | null }`
(activities currently assigned, by name; `lastPerformedAt` over every record of that pair, ever).

- unknown equipment → 404 `equipment-not-found` (the module's existing problem type); unknown
  activity → 404 `qc-activity-not-found`.
- already assigned → 409 `qc-activity-already-assigned`; retired equipment → 409
  `equipment-retired` (existing type; detail «"اکسترودر 1" کنار گذاشته شده است.»).
- unassign of an activity not assigned → 404 `qc-activity-not-assigned`.

### Inspection — recorders

| Route | Body / query | Response |
|---|---|---|
| `GET /qc-inspections` | — | `QcEquipmentReadModel[]` — in-service equipment with ≥ 1 assignment, by name |
| `GET /qc-inspections/:equipmentId` | — | `QcEquipmentReadModel` (retired equipment too, `retired: true`) |
| `POST /qc-equipment/:equipmentId/activities/:activityId/executions` | `{ trackingNumber, notes? }` | 201 `{ id }` |

- `trackingNumber` blank/whitespace/missing → 400 `validation-error`, field `trackingNumber`;
  ≤ 100 chars; any text. `notes` optional, ≤ 2000, blank → stored `null`.
- retired equipment → 409 `equipment-retired` (checked first); activity not assigned to it → 409
  `qc-activity-not-assigned` with detail «"<activity>" به "<equipment>" تخصیص داده نشده است.»;
  unknown equipment 404 `equipment-not-found`; unknown activity 404 `qc-activity-not-found`.
- performer and `performedAt` come from the token and the clock, never the body.

### Records — managers (delete: System Admin only)

| Route | Body / query | Response |
|---|---|---|
| `GET /qc-executions` | `from?, to?, equipmentId?, activityId?, performedById?, trackingNumber?` | `QcExecutionHistoryReadModel` |
| `GET /qc-executions/filter-options` | — | `{ equipment: {id,name,retired}[], activities: {id,name}[], performers: {id,name}[] }` |
| `DELETE /qc-executions/:id` | — | 204 (**SystemAdmin**; unknown → 404 `qc-execution-not-found`) |

`QcExecutionHistoryReadModel` = `{ executions: QcExecutionReadModel[], counts: QcExecutionCountReadModel[] }`.

`QcExecutionReadModel` = `{ id, equipmentId, equipmentName, activityId, activityName,
performedById, performedByName, performedAt, trackingNumber, notes: string | null,
previousPerformedAt: string | null, intervalMinutes: number | null }` — newest first.
`previousPerformedAt`/`intervalMinutes` come from the previous record of the same
(equipment, activity) over **all** records, never the filtered set; `intervalMinutes` =
whole minutes, floored.

`QcExecutionCountReadModel` = `{ equipmentId, equipmentName, activityId, activityName, count }`
over the filtered records, by equipment name then activity name.

- `from`/`to` inclusive ISO instants, each optional; `from` after `to` → 400 `validation-error`
  (field `from`). `trackingNumber` filter: case-insensitive *contains*, trimmed; empty = none.
- Equipment names and activity names are the **current** ones.

### Equipment (existing routes, changed)

- `equipment` dependents gain kinds `qc-assigned-activity` (names: assigned activities) and
  `qc-equipment-execution` (count of QC records, `names: []`).
- `DELETE /equipment/:id` (System Admin, retired only) also deletes its QC assignments and records.
- `PATCH /equipment/:id` with `applyToRelatedRecords` covers QC dependents too.

### Frontend dependents phrases (`recordHasDependentsMessage`)

`qc-assigned-equipment` → `${n} تجهیز` + names; `qc-activity-execution` → `${n} سابقه انجام QC`;
`qc-assigned-activity` → `فعالیت های QC` + names; `qc-equipment-execution` →
`سوابق انجام QC (${n} سابقه)`.

## Tasks

### QA (`acceptance-tests/`)
1. Business Flow for the four new features and the two new rules of `registring-equipment.feature`.
2. Technical layer against the contract above; clock control through the existing tunable clock;
   QR scanning is driven as "the inspection view of equipment X" (the payload is the id) — never
   through a camera.
3. Persona Mostafa (Management), Nikrooz (QC inspector) etc. already exist; reuse.

### Backend (`backend/`, maintenance module)
1. Domain: `QcActivity`, `QcExecution`, QC assignments on `Equipment`, problem exceptions, events.
2. Application: commands (define/rename/delete activity, assign/unassign, record, delete record) and
   queries (catalog, QC equipment list/folder, inspections, records with interval/counts, filter
   options); dependents probe kinds; delete-retired-equipment cascade.
3. Infrastructure: Prisma models + migration (`qc_activity`, `qc_assignment` unique
   `(equipment_id, activity_id)`, `qc_execution`), controllers, DTOs, mappers, audit projection,
   OpenAPI regen.

### Frontend (`frontend/`)
1. Navigation entries and routes (four pages + folder detail), role lists.
2. `/qc-activities`, `/qc-equipment` + `/qc-equipment/:equipmentId`, `/qc-inspection`,
   `/qc-executions`; per-row «دانلود QR تجهیز» on `/equipment`.
3. QR PDF (well-maintained packages, e.g. `qrcode` + `jspdf`), in-app scanner (a maintained decoder
   such as `@zxing/browser` / `qr-scanner`), payload `CABLAN-EQ:<uuid>`.
4. Interval formatting, dependents phrases, a11y routes registered.
