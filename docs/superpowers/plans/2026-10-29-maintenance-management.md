# Maintenance management (CMMS, phase 1) — plan

Design: `docs/superpowers/specs/2026-10-29-maintenance-management-design.md`. Issue #69.

## HTTP contract (pinned — QA, backend and frontend all build to these names)

Roles enum (identity) gains `technical_manager` and `pm_inspector`. Persian labels: `مدیر فنی`,
`بازرس PM`. `TM` below = `system_admin` + `technical_manager`; `PM` = `TM` + `pm_inspector`.

Dates are ISO `YYYY-MM-DD` (Gregorian, Tehran calendar date); instants are ISO-8601 strings.

| Method + route | Roles | Body | Success |
|---|---|---|---|
| `POST /equipment` | TM | `{ name }` | 201 `{ id }` |
| `PATCH /equipment/:id` | TM | `{ name }` | 204 |
| `POST /equipment/:id/retirement` | TM | — | 204 |
| `GET /equipment` | TM | — | 200 `EquipmentReadModel[]` = `{ id, name, retired: boolean }`, by name |
| `GET /equipment/:id` | TM | — | 200 `{ id, name, retired, planItems: PmPlanItemReadModel[] }` |
| `POST /maintenance-activities` | TM | `{ name }` | 201 `{ id }` |
| `PATCH /maintenance-activities/:id` | TM | `{ name }` | 204 |
| `GET /maintenance-activities` | TM | — | 200 `{ id, name }[]`, by name |
| `POST /equipment/:id/pm-plan-items` | TM | `{ activityId, intervalValue, intervalUnit: 'days' \| 'operating_hours', firstDueDate }` | 201 `{ id }` |
| `PATCH /equipment/:id/pm-plan-items/:itemId` | TM | `{ intervalDays }` | 204 |
| `DELETE /equipment/:id/pm-plan-items/:itemId` | TM | — | 204 (soft remove) |
| `POST /equipment/:id/pm-plan-items/:itemId/executions` | PM | `{ notes?: string }` | 201 `{ id, dueDate }` |
| `GET /pm-schedule/daily` | PM | — | 200 `DailyPmTaskReadModel[]` |
| `GET /pm-schedule/overview` | PM | — | 200 `PmOccurrenceReadModel[]` |
| `GET /equipment/:id/maintenance-history` | PM | — | 200 `MaintenanceExecutionReadModel[]` |

- `PmPlanItemReadModel` = `{ id, activityId, activityName, intervalDays, firstDueDate, nextDueDate }`
  (active items only, in the order they were added).
- `DailyPmTaskReadModel` = `{ equipmentId, equipmentName, planItemId, activityId, activityName,
  dueDate, status: 'due' | 'overdue', daysOverdue }` — ordered by equipment name, then plan order.
- `PmOccurrenceReadModel` = `{ equipmentId, equipmentName, planItemId, activityName, dueDate,
  status: 'on_time' | 'late' | 'missed' | 'overdue' | 'due' | 'upcoming', performedAt: string |
  null, performedBy: string | null }` — for every active item of non-retired equipment, every
  occurrence from its first due date through the next one not yet reached, ordered by equipment
  name, plan order, due date.
- `MaintenanceExecutionReadModel` = `{ id, activityName, dueDate, performedAt, performedBy, status:
  'on_time' | 'late', notes: string | null }` — `performedBy` is the user's display name; newest
  first. Includes executions of removed items and of retired equipment.

Problem types (RFC 9457, as the rest of the API):

| Type | Status | When |
|---|---|---|
| validation (existing) | 400 | empty `name`, missing `intervalValue`/`firstDueDate`/`activityId`, non-positive interval |
| `equipment-name-taken` | 409 | duplicate equipment name on create or rename |
| `maintenance-activity-name-taken` | 409 | duplicate activity name on create or rename |
| `activity-already-in-pm-plan` | 409 | activity already active in this equipment's plan |
| `usage-based-interval-not-supported` | 400 | `intervalUnit: 'operating_hours'` |
| `equipment-retired` / `pm-plan-item-removed` | 409 | writes against a retired equipment / removed item |
| not found (existing) | 404 | unknown equipment / activity / item |
| forbidden (existing) | 403 | role not allowed |

Each problem carries a Persian `detail`; the usage-based one says the plan can only be defined in
days (`برنامه فقط بر اساس روز قابل تعریف است`).

## Tasks

### QA (`acceptance-tests/`)
1. Personas: `رضازاده` (`technical_manager`) and `مسلمی` (`pm_inspector`), provisioned through
   the admin like the other personas.
2. Automate the five `maintenance-management/*.feature` files and the two edited existing ones
   (new role rows in `registring-user.feature`, the extra denied personas everywhere).
3. Clock steps (`امروز "…" باشد`, `اکنون "…" ساعت "…" باشد`, `… در "…" ثبت شده باشد`) drive the
   existing testing clock; Jalali → Gregorian conversion stays in the suite.
4. Page objects for the five new pages, locators by role/accessible name, `ASSUMPTION` comments.

### Backend (`backend/`)
1. Identity: `Role` gains the two values (Prisma enum migration, DTO enum, OpenAPI).
2. Restrict every existing `JwtAuthGuard`-only read in `boms`, `products`,
   `manufacturing-instructions` (and anything else outside identity's own session endpoints and
   the testing module) to the four existing roles.
3. New `maintenance` module: domain (`Equipment` + `PmPlanItem` + schedule value objects,
   `MaintenanceActivity`, `MaintenanceExecution`, the pure occurrence/status calculator), application
   (commands + queries above), infrastructure (Prisma models, repositories, controllers, DTOs,
   exception mappers), audit entries like every aggregate. Unit tests for the calculator cover every
   row of the design's status table, the interval-change segment rule and the execution-targeting
   rule.
4. Regenerate the OpenAPI spec.

### Frontend (`frontend/`)
1. `Role` labels for the two roles in the users page.
2. `navigation.ts`: under `master-data` add `equipment` (`تجهیزات / دستگاه`) and
   `maintenance-activities` (`فعالیت های تعمیرات و نگهداری`), roles TM; new top-level category
   `technical` (`فنی`) with `pm-plans` (`برنامه PM تجهیزات`, TM), `pm-schedule/daily`
   (`برنامه روزانه PM`, PM) and `pm-schedule/overview` (`وضعیت تعمیرات و نگهداری`, PM).
3. Pages: equipment list/add/rename/retire; activity list/add/rename; PM plan per equipment (add item
   with activity, interval in days, Jalali first due date; change interval; remove; history table);
   daily list (equipment, activity, due date, status, days overdue, «ثبت انجام» with optional notes);
   overview table (equipment, activity, due date, status, performed by, performed at). Persian
   problem details shown as form errors.
4. Register every new route in `a11y/accessibility.spec.ts`.
