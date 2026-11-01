# PM plan item deactivation — plan (issue #91)

Design: `docs/superpowers/specs/2026-11-01-pm-plan-item-deactivation-design.md`.

## Contract (pinned)

- `POST /api/equipment/:id/pm-plan-items/:itemId/deactivation` — no body → 204. Planner roles.
  403 for others; 404 unknown equipment/item; 409 `equipment-retired`; 409
  `pm-plan-item-deactivated` when already deactivated.
- `DELETE /api/equipment/:id/pm-plan-items/:itemId` — removed (404).
- No reactivation route.
- `PATCH /api/equipment/:id/pm-plan-items/:itemId` and
  `POST /api/equipment/:id/pm-plan-items/:itemId/executions` on a deactivated row → 409
  `pm-plan-item-deactivated`.
- `GET /api/equipment/:id` →
  `{ id, name, retired, planItems: [{ id, activityId, activityName, intervalDays, firstDueDate, nextDueDate }], inactivePlanItems: [{ id, activityId, activityName, intervalDays, firstDueDate, deactivatedAt }] }`.

## Backend (`backend-engineer`)

1. Domain: rename `removedAt` → `deactivatedAt`, `removePlanItem` → `deactivatePlanItem`,
   `PmPlanItemRemoved` → `PmPlanItemDeactivated`, `PmPlanItemIsRemoved` → `PmPlanItemIsDeactivated`;
   refusing every write on a deactivated row, including a second deactivation.
2. Application: `DeactivatePmPlanItemCommand`/`Handler` replace the remove pair; `GetEquipmentHandler`
   adds `InactivePmPlanItemReadModel` list.
3. Infrastructure: controller route, schemas, exception mapper, Prisma field
   `deactivatedAt @map("removed_at")` (no migration), integration spec, OpenAPI regenerated.
4. Audit-logging handler renamed, Persian line «غیرفعال‌سازی».

## QA (`qa-engineer`)

Automate the new/changed scenarios of `planning-preventive-maintenance.feature`; re-route every
"remove" task (incl. `pm-schedule-overview.feature`'s precondition) to the deactivation endpoint /
UI action; add questions for the active plan and the inactive list (UI) and the "tries to" API
attempts.

## Frontend (`frontend-engineer`)

`make sync-api-contract` first (orchestrator). Gateway `deactivateItem`; rename dialog; row menu
item «غیرفعال‌سازی»; «فعالیت‌های غیرفعال» read-only table; error mapping; specs; a11y fixtures
include inactive rows.
