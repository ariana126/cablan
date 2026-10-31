# Maintenance (`src/modules/maintenance/`)

CMMS, phase 1 (issue #69): equipment, a catalog of maintenance activities, a calendar-based
preventive-maintenance (PM) plan per piece of equipment, the daily list of due work, recording that
a job was done, and the history and status views that later plan changes never rewrite. Design:
`docs/superpowers/specs/2026-10-29-maintenance-management-design.md`; the pinned HTTP contract is
in the plan beside it. Follows the vertical-slice layout in `backend/CLAUDE.md`'s "Architecture"
section. It depends on no other feature module and no module depends on it, apart from
`audit-logging`'s handlers.

## Endpoints

Two role lists, both in `domain/value/maintenance-roles.ts`: `MAINTENANCE_PLANNER_ROLES`
(SystemAdmin, TechnicalManager) and `PM_SCHEDULE_ROLES` (those plus PmInspector). Every controller
is `@UseGuards(JwtAuthGuard, RolesGuard)` with a class-level `@Roles()`; a handler-level `@Roles()`
overrides it.

| Route | Roles | Handler |
|---|---|---|
| `POST /equipment` | planner | `RegisterEquipmentHandler` → 201 `{ id }` |
| `PATCH /equipment/:id` | planner | `RenameEquipmentHandler` → 204 |
| `POST /equipment/:id/retirement` | planner | `RetireEquipmentHandler` → 204 |
| `GET /equipment` | planner | `ListEquipmentHandler` (retired included, `retired` flag) |
| `GET /equipment/:id` | planner | `GetEquipmentHandler` (active plan items, with `nextDueDate`) |
| `GET /equipment/:id/maintenance-history` | **schedule** | `GetEquipmentMaintenanceHistoryHandler` (newest first) |
| `POST /maintenance-activities` | planner | `RegisterMaintenanceActivityHandler` → 201 `{ id }` |
| `PATCH /maintenance-activities/:id` | planner | `RenameMaintenanceActivityHandler` → 204 |
| `GET /maintenance-activities` | planner | `ListMaintenanceActivitiesHandler` |
| `POST /equipment/:id/pm-plan-items` | planner | `AddPmPlanItemHandler` → 201 `{ id }` |
| `PATCH /equipment/:id/pm-plan-items/:itemId` | planner | `ChangePmPlanItemIntervalHandler` → 204 |
| `DELETE /equipment/:id/pm-plan-items/:itemId` | planner | `RemovePmPlanItemHandler` → 204 (soft) |
| `POST /equipment/:id/pm-plan-items/:itemId/executions` | **schedule** | `RecordMaintenanceExecutionHandler` → 201 `{ id, dueDate }` |
| `GET /pm-schedule/daily` | schedule | `GetDailyPmScheduleHandler` |
| `GET /pm-schedule/overview` | schedule | `GetPmScheduleOverviewHandler` |

`src/route-roles.spec.ts` pins the other half of the role split: no route **outside** this module
admits `TechnicalManager` or `PmInspector`, and every signed-in route outside it names its roles
(identity's `me` is the one exception).

Every "by name" list sorts with `byPersianName` (`application/service/persian-order.ts`,
`localeCompare(…, 'fa')`), so «پ» follows «ب». The daily list and the overview order by equipment
name, then plan order (the order items were added), then due date. Both skip retired equipment and
removed items; the history keeps them.

The reads go through the write repositories (`PmPlanReader` loads the equipment, the whole
activity catalog and the executions once per query, then the domain's `PmOccurrences` computes
every status). There is no read-side Prisma repository yet; it loads everything into memory, which
is fine at phase-1 volumes.

## Aggregates

- **`Equipment`** — a unique, trimmed `name` and `retiredAt`. It **owns its `PmPlanItem`s**, so
  "one activity at most once among an equipment's active items" is a single-aggregate invariant.
  Retiring is a soft stop (never deleted, the name stays taken). After that every write on it is a
  409 `equipment-retired`: a rename, adding an item, changing an interval, removing an item or
  recording an execution.
- **`PmPlanItem`** (entity inside `Equipment`) — `activityId`, a snapshot `activityName` (for the
  audit lines; reads show the activity's **current** name), a `PmSchedule` and `removedAt`. It is
  removed softly and never deleted, because executions name its id. A removed item is a 409
  `pm-plan-item-removed` for every further write, and it frees its activity to be added again.
- **`MaintenanceActivity`** — the catalog: a unique, trimmed `name`, nothing else.
- **`MaintenanceExecution`** — its own aggregate and the history. It snapshots the equipment,
  activity and performer names, and it judges itself: on time or late comes from its own `dueDate`
  and the Tehran date of its `performedAt`, never from the current schedule. Recording one saves
  only the execution, not the `Equipment`. `Equipment.recordExecutionOf()` takes the activity from
  the plan item and only its **current name** from the caller, so an execution of the wrong
  activity cannot be expressed.

Names (equipment and activity) are at most 200 characters and execution notes at most 2000. Both
limits are enforced by the DTOs only (`@MaxLength`), not by the value objects.

No foreign key runs between aggregates (ADR 0004). The only relation is `pm_plan_item` →
`equipment` (cascade), which is inside one aggregate.

## Schedule segments

`PmSchedule` (`domain/value/pm-schedule.vo.ts`) is an ordered list of segments
`{ startDueDate, intervalDays }`, stored as JSON in `pm_plan_item.schedule`. A segment generates
`startDueDate + k·intervalDays` up to, but not including, the next segment's start. Adding an item
creates one segment, and changing the interval appends one. Each later segment must start on a
due date of the previous segment, strictly after the previous segment's start.
`fromSegments()` throws a plain `Error` on a stored schedule that breaks this. A change starting on
the last segment's own start date **replaces** that segment.

Where a change starts is `PmOccurrences.intervalChangeStart(today)`: the **current occurrence**
(the latest due date on or before today, or the first due date while that is still ahead). If an
execution already covers a later due date, the change starts at the latest executed date instead,
so no execution is left on a date the new interval no longer generates. Past due dates therefore
keep coming from the interval they fell under, and their statuses never move. Changing to the same
interval records nothing.

**Bounds.** An interval is 1 to `MAX_INTERVAL_DAYS` (36500, a hundred years). That is a domain
rule in `IntervalDays.of()`, mirrored by `@Max` on both interval DTOs so a request over it is a 400.
`CalendarDate` holds years 0001–9999, both from a string and after day arithmetic, which throws
rather than producing a malformed date. `firstDueDate` is further bounded to years 2000–2100 in
the DTO (`IsCalendarDate({ from, to })`). Together these keep every due date a read walks inside
the calendar. Without them, one huge interval made `occurrenceWindow` overflow and the daily list,
the overview and `GET /equipment/:id` all failed with a 500, for every user.

Intervals are in days only. The add-item body carries `intervalUnit: 'days' | 'operating_hours'`,
and `operating_hours` is a **400** `usage-based-interval-not-supported`, not a 409. It is the
request's own fault, and the unit is modelled so that phase 2 can add it.

## Statuses and the next due date

`domain/pm-occurrences.ts` is the pure calculator behind every read and the recording rule.
**Nothing missed is ever stored**: every status is computed from the schedule, the executions and
today. For occurrence `dₖ`, next occurrence `dₖ₊₁` and today `T`:

| Executed? | T | Status (`PmOccurrenceStatus`, crosses HTTP as is) |
|---|---|---|
| yes, performed on or before `dₖ` (Tehran date) | — | `on_time` |
| yes, performed after `dₖ` | — | `late`, `daysLate` = Tehran performed day − `dₖ` |
| no | `T ≥ dₖ₊₁` | `missed` |
| no | `dₖ < T < dₖ₊₁` | `overdue`, `daysOverdue = T − dₖ` |
| no | `T = dₖ` | `due` |
| no | `T < dₖ` | `upcoming` |

`daysOverdue` is `0` in every status but `overdue`. `daysLate` (`MaintenanceExecution.daysLate()`,
derived, never stored) is `null` in every status but `late`, on purpose unlike `daysOverdue`'s `0`;
the equipment history and the overview carry it, the daily list does not. The daily list is each item's current
occurrence while it is `due` or `overdue`. The overview lists every occurrence from the first due
date through the next one not yet reached.

**Next due date** = the occurrence an execution recorded now is for: the earliest due date on or
after the current occurrence that has no execution yet. So a missed occurrence can never be
recorded, and a job done early covers the upcoming date and moves the plan on. Recording is always
"now" (`Clock`) by the signed-in actor, with optional `notes`: no back-dating and no other outcome.

## Tehran dates

Due dates are `CalendarDate`s (`domain/value/calendar-date.vo.ts`): Gregorian ISO `YYYY-MM-DD`
with no time of day, and day arithmetic in whole epoch days, so DST and offsets never enter.
`performedAt` is an instant. Every instant becomes a date through **one** helper,
`CalendarDate.inTehranOf(instant)` (`@date-fns/tz`, `MAINTENANCE_TIME_ZONE = 'Asia/Tehran'`), so
"today" and "the day it was performed on" are Tehran dates whatever zone the server runs in. A
UTC comparison would put a late-evening Tehran execution on the wrong day. Dates cross HTTP as ISO
strings (`IsCalendarDate` validates them in the DTOs), and the frontend shows them in Jalali.
`maintenance_execution.due_date` is `@db.Date`; the integration suite proves it reads back as the
same calendar date. The test stack's `TunableClock` drives "today" like every other clock reading.

## Uniqueness, and its 409s

The handlers and the aggregate refuse each case first. The unique index is the backstop for two
writes that both passed that check, and each repository's `save()` translates the index's P2002
into the same exception through `infrastructure/persistence/unique-violation.ts`
(`isUniqueViolationOn(error, ...columns)`, which reads the columns at
`meta.driverAdapterError.cause.constraint.fields`, as `products` does).

| Index | Exception → problem type (409) |
|---|---|
| `equipment.name` | `EquipmentNameTaken` → `equipment-name-taken` (`name`) |
| `maintenance_activity.name` | `MaintenanceActivityNameTaken` → `maintenance-activity-name-taken` (`name`) |
| `pm_plan_item_active_activity_key` (`equipment_id, activity_id`) `WHERE removed_at IS NULL` | `ActivityAlreadyInPmPlan` → `activity-already-in-pm-plan` (`equipmentId`, `activityId`) |
| `maintenance_execution (plan_item_id, due_date)` | `PmOccurrenceAlreadyRecorded` → `pm-occurrence-already-recorded` (`planItemId`, `dueDate`) |
| `pm_plan_item (equipment_id, position)` | `EquipmentChangedConcurrently` → `equipment-changed-concurrently` (`equipmentId`) |

The last index has no domain rule behind it. `EquipmentMapper` numbers items by their index in
`planItems()`, so two requests that loaded the same plan and each added a *different* activity
both insert the same `position`. The second is told the plan changed meanwhile and should retry.

**Trap: the position index also fires for two adds of the *same* activity.** Both items take
position 0 too. Postgres checks a row's unique indexes in creation order, and the generated
`(equipment_id, position)` index predates the hand-added partial one, so it is the one reported.
`PrismaEquipmentRepository.save()` therefore never maps a position clash blindly.
`conflictOnPosition()` reads the committed plan after the rollback: if another active item already
has the new item's activity, the answer is `activity-already-in-pm-plan`, otherwise
`equipment-changed-concurrently`. Inside an outer transaction (no caller has one today) that read
is impossible, and the answer falls back to the generic conflict.

The partial index was **added by hand** to migration `20261029201519_maintenance_management`,
because Prisma's schema cannot express it. `maintenance.prisma` therefore does not show it, and a
regenerated migration would not contain it. Names are compared exactly, after trimming and
`toAsciiDigits` (as in `products`, «۱۲» and «12» are one name). `test/integration/maintenance-persistence.int-spec.ts`
pins the round trip of segments and removal, the audit entry, the date column and four of the five
backstops (all but the activity name).

Each problem's `detail` is the Persian sentence the form shows (`exception.mapper.ts`).
`MaintenanceExceptionMapper` is registered in `framework/infrastructure/http/exception.filter.ts`.

## Known gap

- **Recording an execution does not lock the equipment.** The handler checks that the equipment is
  in service and the item is active, then saves only the execution. An execution can therefore
  commit after a concurrent retirement or removal that it raced.
