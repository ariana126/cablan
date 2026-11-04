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
| `PATCH /equipment/:id` | planner | `RenameEquipmentHandler` → 204; body `{ name, applyToRelatedRecords? }` (`RenameEquipmentDto`; see [System Admin exceptions](#system-admin-exceptions-issue-110)) |
| `POST /equipment/:id/retirement` | planner | `RetireEquipmentHandler` → 204 |
| `POST /equipment/:id/reactivation` | **SystemAdmin** | `ReactivateEquipmentHandler` → 204; body `{ rescheduledItems?: { planItemId, firstDueDate }[] }` (issue #110) |
| `DELETE /equipment/:id` | **SystemAdmin** | `DeleteEquipmentHandler` → 204 — retired equipment only, with its plan and history (issue #110) |
| `GET /equipment` | planner | `ListEquipmentHandler` (retired included, `retired` flag; `activePlanItemCount`, deactivated items excluded) |
| `GET /equipment/:id` | planner | `GetEquipmentHandler` (`planItems`: active, with `nextDueDate`; `inactivePlanItems`: deactivated, read-only — retired equipment included) |
| `GET /equipment/:id/maintenance-history` | **schedule** | `GetEquipmentMaintenanceHistoryHandler` (newest first; each row's `id`, `planItemId`, `activitySpecialty`, current, and `operatingHours`) |
| `POST /maintenance-activities` | planner | `RegisterMaintenanceActivityHandler` → 201 `{ id }`; body `{ name, specialty }`, both required |
| `PATCH /maintenance-activities/:id` | planner | `EditMaintenanceActivityHandler` → 204; body `{ name, specialty, applyToRelatedRecords? }` (`EditMaintenanceActivityDto`) |
| `GET /maintenance-activities` | planner | `ListMaintenanceActivitiesHandler` (`{ id, name, specialty }`, `specialty` null while missing) |
| `GET /maintenance-activities/unassigned-specialties` | **SystemAdmin** | `ListActivitiesWithoutSpecialtyHandler` → `{ id, name }[]` by Persian name (see [Specialties](#specialties-and-operating-hours)) |
| `POST /maintenance-activities/specialty-assignment` | **SystemAdmin** | `CompleteMissingSpecialtiesHandler` → 204; body `{ assignments: { activityId, specialty }[] }` |
| `POST /equipment/:id/pm-plan-items` | planner | `AddPmPlanItemHandler` → 201 `{ id }` |
| `PATCH /equipment/:id/pm-plan-items/:itemId` | planner | `ChangePmPlanItemIntervalHandler` → 204 |
| `POST /equipment/:id/pm-plan-items/:itemId/deactivation` | planner | `DeactivatePmPlanItemHandler` → 204 (issue #91; no reactivation route) |
| `DELETE /equipment/:id/pm-plan-items/:itemId` | **SystemAdmin** | `DeletePmPlanItemHandler` → 204 — an inactive row only, with its executions (issue #110) |
| `POST /equipment/:id/pm-plan-items/:itemId/executions` | **schedule** | `RecordMaintenanceExecutionHandler` → 201 `{ id, dueDate }`; body `{ notes?, operatingHours? }` |
| `DELETE /equipment/:id/pm-plan-items/:itemId/executions` | **SystemAdmin** | `DeleteMaintenanceExecutionsHandler` → 204 — every execution of the row (none: still 204) |
| `DELETE /equipment/:id/pm-plan-items/:itemId/executions/:executionId` | **SystemAdmin** | `DeleteMaintenanceExecutionHandler` → 204 — one execution (of another row: 404) |
| `GET /pm-schedule/daily` | schedule | `GetDailyPmScheduleHandler` |
| `GET /pm-schedule/overview?from&to&…` | schedule | `GetPmScheduleOverviewHandler` (occurrences whose `dueDate` ∈ [from, to]) |
| `GET /pm-schedule/calendar?from&to&…` | schedule | `GetPmScheduleCalendarHandler` (the same rows, by `calendarDate` ∈ [from, to]) |
| `GET /pm-schedule/filter-options` | schedule | `GetPmScheduleFilterOptionsHandler` → `{ equipment: {id,name,retired}[], activities: {id,name,specialty}[], performers: {id,name}[] }` |
| `GET /pm-dashboard?periodDays&equipmentId` | **planner** | `GetPmDashboardHandler` → `PmDashboardReadModel` (issue #89; see [Dashboard](#dashboard)) |

**The two range reads (issue #90).** Both take `PmScheduleRangeQueryDto`: `from`, `to` (ISO,
inclusive) and the optional, combinable filters `equipmentId`, `activityId` (uuids), `specialty`
(`electrical`/`mechanical`; an activity without a specialty matches neither), `status` (a
`PmOccurrenceStatus`) and `performedById` (a user id; it leaves out rows nobody has done). `from`
and `to` are `@IsOptional` **on purpose** (documented as required; the DTO disables
`api-property-matches-property-optionality` on those two for that reason): a missing or empty one
is refused by the finder, and `from` after `to` by `CalendarDateRange.between()` as the domain's
`DateRangeStartsAfterEnd`, which the finder turns into the same `InvalidPmScheduleRange` → 400
`invalid-pm-schedule-range` (Persian detail). A malformed date is the ordinary 400
`validation-error`. The guards run before either, so a forbidden role is a 403 whatever the range.
Both handlers delegate to `PmOccurrenceFinder` (`application/service/pm-occurrence-finder.ts`) and
differ only in the `PmScheduleView` they pass it, `byDueDate` or `byCalendarDate`. A view names both
the executions it loads and the domain method it reads with, so the two cannot drift apart. Each
row (`PmOccurrenceReadModel`, beside the finder in `application/service/`) carries
`equipmentRetired`, `activityId`, `activitySpecialty`, `calendarDate`, `performedById` and `notes`
besides the old fields. `filter-options` exists because `GET /equipment` and `GET /maintenance-activities` are
planner-only. Its performers come from `MaintenanceExecutionRepository.performers()`, one
`DISTINCT ON (performed_by_id)` row each, named by their latest execution's snapshot.

`src/route-roles.spec.ts` pins the other half of the role split: no route **outside** this module
admits `TechnicalManager` or `PmInspector`, and every signed-in route outside it names its roles
(identity's `me` is the one exception).

Every "by name" list sorts with `byPersianName` (`application/service/persian-order.ts`,
`localeCompare(…, 'fa')`), so «پ» follows «ب». The daily list and the two range reads order by
equipment name, then plan order (the order items were added, deactivated items keeping their place),
then due date. The daily list skips retired equipment and deactivated items; the range reads and the
history keep them.

The reads go through the write repositories (`PmPlanReader` loads the equipment and the whole
activity catalog once per query, then the domain's `PmOccurrences` computes every status).

- `read()` serves the daily list and `GET /equipment/:id`. It gives each piece of equipment's active
  items with **every** execution of that equipment (`forEquipments`), and judges each item as in
  force (`Equipment.occurrencesInForceOf`): no stop date, only the service gaps that ended, so the
  detail still shows a retired equipment's next due dates.
- `named(items)` gives items their current activity names with no occurrences — the detail's
  `inactivePlanItems`. It is a second catalog read for that one query (skipped when there are none).
- `readWithHistory(equipment, include, executionsOf)` serves the range reads. It gives every item,
  deactivated ones included, each judged by `Equipment.occurrencesOf` (its deactivation day as stop
  date, every service gap, a still-open one included), and loads only the
  executions `executionsOf` returns for those items. That is `dueIn(planItemIds, range)` for the
  table and `dueOrPerformedIn(planItemIds, range)` for the calendar (due in the range, **or**
  performed on a Tehran day in it, through `CalendarDate.instantsInTehran()`). A range read never
  loads the whole history. `equipmentId` loads one aggregate with `find()`, and `activityId` and
  `specialty` narrow the plan items before the executions query (`include` sees each item's current
  activity).

The occurrences themselves are not walked either: `PmSchedule.dueDatesBetween(from, to)` computes
per segment only the due dates a range holds, and `occurrenceAfter`/`latestDueDateOnOrBefore` are
arithmetic too. The daily list and the detail still load all executions of the equipment they show.

**A range is bounded.** Without bounds, `?from=0001-01-01&to=9999-12-31` over a 1-day interval
generated millions of rows per item. The bounds are:
- Both dates must fall in years 2000–2100, `firstDueDate`'s window (`IsCalendarDate`, a validation
  400).
- The range may span at most `MAX_PM_SCHEDULE_RANGE_DAYS` = 3660 days, both ends counted
  (`domain/value/pm-schedule-range-limit.ts`, checked with `CalendarDateRange.days()` in the
  finder's `rangeOf`). Over that it is `InvalidPmScheduleRange.tooLong` → the same 400
  `invalid-pm-schedule-range`, with the detail «بازه تاریخ نمی تواند بیشتر از ده سال باشد.»
  (the exception's `reason` picks the detail).
- An empty bound (`?from=`) is read as missing (`@Transform`), so it is the range problem too, not
  a validation error.

## Dashboard

`GET /pm-dashboard` (issue #89, «داشبورد مدیریتی فنی») is a read over the same calculator: no
aggregate, nothing stored. Design and pinned contract:
`docs/superpowers/specs/2026-11-01-technical-management-dashboard-design.md` and its plan. It is
the one PM read the PM inspector cannot reach (`MAINTENANCE_PLANNER_ROLES`, a 403).
`PmDashboardQueryDto` reads `periodDays` as a number (`@Type`) and takes 7, 30 or 90, default 30;
anything else, an empty value included, is a 400 `validation-error`. `equipmentId` is a uuid; an
unknown one is `EquipmentRepository.get()`'s 404. It scopes every panel but coverage.

The rules are in the domain; the handler only loads, assembles and orders:

- `PmDashboardPeriod` (`domain/value/`): the period `[today − (days − 1), today]`, its past days
  `[from, today − 1]` that performance is judged on, the follow-up window to `today + 7`, the next
  seven days and the daily/weekly trend buckets (weeks counted back from yesterday, the oldest
  clipped). It also owns the before-period rule: `dueDateWindowOf(schedule)` starts each item's
  read at its due date just before the period — the only earlier occurrence that can still be
  overdue or turn missed inside it — and `followsUp(occurrence)` keeps that one only while
  `overdue` or once it turned missed inside the period (`sawTurnMissed`).
- `PmOccurrence.missedOn`: the schedule's next due date after a `missed` occurrence, the day it
  turned missed (even when a stopped item no longer generates that date); `null` otherwise.
- `PmPerformance` (`domain/pm-performance.ts`): on time / late / not done of the occurrences due in
  a range, days late from `ExecutedOccurrence.daysLate()` — the same expression the rows carry.
- `PmCoverage` (`domain/pm-coverage.ts`): equipment in service, and which `Equipment.hasPmPlan()`
  (at least one item not deactivated, even one first due ahead). Plant-wide.
- `wholePercent` (`domain/value/whole-percent.ts`): the one rounding rule of every percentage,
  `null` with nothing to take a share of.
- "Active" is `Equipment.isInForce(item)` — the rule `planItemOpenForWork` refuses work by — and a
  row is `recordable` when it is active and `PmOccurrences.awaitsRecording(dueDate, today)`: its day
  has come and it is the `nextDueDate` an execution recorded today would be for, so the dashboard
  and `Equipment.recordExecutionOf` cannot drift apart.

The handler orders the most-overdue ranking (count desc, days desc, `byPersianName`), the upcoming
list and coverage's equipment without a plan.

**Bounded loading.** Each plan item (deactivated ones and retired equipment included, so history
survives up to its deactivation and outside its service gaps) is read over its `dueDateWindowOf`. Its executions are loaded
first — `MaintenanceExecutionRepository.dueWithinOwnRanges` (each item's executions due within its
own range, one `OR` query) plus `dueOrPerformedIn(ids, [today, today])` for jobs performed today,
whatever their due date — and handed to `readWithHistory`. Any occurrence done today outside the
window is added (one `PmOccurrences.generatesOn` refuses — past the deactivation day — is skipped).
Every gap's due dates are left out of performance and the trends (the approved 80% example), and a
reactivated equipment counts in coverage again: `PmCoverage` is current state. "Current"
due/overdue, the ranking and upcoming count active items only; `doneToday`, missed and performance
count history too.

## Aggregates

- **`Equipment`** — a unique, trimmed `name` and its **service breaks** (`ServiceBreak`, issue
  #110: `{ retiredAt, reactivatedAt | null }`, oldest first). It is retired while its last break is
  open (`isRetired()`; `retiredAt()` is that break's start, `null` in service). It **owns its
  `PmPlanItem`s**, so "one activity at most once among an equipment's active items" is a
  single-aggregate invariant. Retiring is a soft stop (the row and its name stay). While retired
  every ordinary write on it is a 409 `equipment-retired`: a rename, adding an item, changing an
  interval, deactivating an item or recording an execution. Only the System Admin brings it back
  or deletes it — see [System Admin exceptions](#system-admin-exceptions-issue-110).
- **`PmPlanItem`** (entity inside `Equipment`) — `activityId`, a snapshot `activityName` (for the
  audit lines; reads show the activity's **current** name), a `PmSchedule` and `deactivatedAt` (column `removed_at`, from before issue #91 renamed removal to
  deactivation — no migration, so the hand-added partial index below still names it). It is
  deactivated rather than deleted, because executions name its id; only the System Admin deletes
  an inactive row, with its executions (issue #110). A deactivated item is a 409
  `pm-plan-item-deactivated` for every further write — a second deactivation, an interval change,
  an execution — and there is no reactivation. It frees its activity to be added again as a **new**
  row with its own id and schedule, so one activity can have any number of inactive rows beside at
  most one active one. An **inactive** item is exactly a **deactivated** one — the UI and the read
  model say "inactive", the command and the event say "deactivate". `Equipment.inactivePlanItems()`
  returns them in plan order, typed `DeactivatedPmPlanItem` (a non-null `deactivatedAt()`);
  `GetEquipmentHandler` orders them for the folder, by `deactivatedAt` ascending, ties in plan
  order. `GET /equipment/:id`'s `inactivePlanItems` carries each one's current activity name, its
  last segment's interval, first due date and `deactivatedAt` (ISO instant).
- **`MaintenanceActivity`** — the catalog: a unique, trimmed `name` and one `ActivitySpecialty`,
  `null` only for an activity registered before issue #108 (see
  [Specialties](#specialties-and-operating-hours)). `edit(name, specialty)` records one
  `MaintenanceActivityEdited` listing only the fields that changed, nothing when neither did.
- **`MaintenanceExecution`** — its own aggregate and the history. It snapshots the equipment,
  activity and performer names, keeps the `operatingHours` the performer reported (or `null`), and
  it judges itself: on time or late comes from its own `dueDate`
  and the Tehran date of its `performedAt`, never from the current schedule. Recording one saves
  only the execution, not the `Equipment`. `Equipment.recordExecutionOf()` takes the activity from
  the plan item and only its **current name** from the caller, so an execution of the wrong
  activity cannot be expressed.

**A record a PM plan holds is locked (issue #94).** Equipment with any plan item, and an activity in
any plan item — active or deactivated alike — cannot be edited: 409 `record-has-dependents`, kind
`equipment-pm-plan`, named by the equipment (for an equipment, itself). For an activity that covers
its name and its specialty alike, a specialty-only edit included. Two exceptions: completing a
missing specialty, below, and the System Admin's name correction (issue #110, below).
`RenameEquipmentHandler`/`EditMaintenanceActivityHandler` go through the framework's
`RecordDependencies.editRecordInUse()` right after loading the record, so for retired equipment
that has plan items this 409 comes before `equipment-retired`. Every execution hangs off a plan
item, and a plan item goes only with its executions, so they cover the execution history too. `PrismaMaintenanceDependentsProbe`
(`infrastructure/persistence/maintenance-dependents.probe.ts`) answers from `pm_plan_item`. PM plan
operations and retirement are not guarded. See `src/framework/CLAUDE.md`.

Names (equipment and activity) are at most 200 characters and execution notes at most 2000. Both
limits are enforced by the DTOs only (`@MaxLength`), not by the value objects.

## Specialties and operating hours

Issue #108. Design:
`docs/superpowers/specs/2026-11-03-activity-specialty-and-operating-hours-design.md`; the pinned
HTTP contract is in the plan beside it.

- **`ActivitySpecialty`** (`domain/value/activity-specialty.vo.ts`) is `electrical` («برق») or
  `mechanical` («مکانیک»), crossing HTTP as is. `ACTIVITY_SPECIALTIES` is what the DTOs' `@IsIn`
  checks, so a missing, unknown or doubled value (`["electrical","mechanical"]`) is a 400
  `validation-error` on `specialty`. The DTO properties are plain `string`s (the
  `nestjs-typed` rule refuses a union type there) and the controllers read them with
  `ActivitySpecialty.fromString`. Column `maintenance_activity.specialty`, nullable text.
- **Without a specialty («تخصص تعیین نشده»).** Activities registered before issue #108 have
  `null`. Reads show it as `null` and the range reads' `specialty` filter never matches it.
  The System Admin completes them all at once: `GET …/unassigned-specialties` lists them, and
  `POST …/specialty-assignment` must name exactly those, each once. `MissingSpecialties`
  (`domain/service/missing-specialties.ts`, a domain service) checks the whole assignment before
  changing any activity. A mismatch is `SpecialtyAssignmentMismatch` → 400
  `specialty-assignment-incomplete` («تخصص همه فعالیت ها باید تعیین شود.», `missingActivityIds`,
  `unexpectedActivityIds`). Each activity then gets `completeMissingSpecialty()` →
  `MaintenanceActivitySpecialtyAssigned`. This is the one change that **skips the PM-plan lock**, so
  the aggregate refuses it for an activity that already has a specialty
  (`ActivityAlreadyHasSpecialty` → 409 `activity-already-has-specialty`, normally unreachable).
  Nothing records that the completion happened: the list being empty is the answer.
- **One lock for both writers.** `EditMaintenanceActivityHandler` and
  `CompleteMissingSpecialtiesHandler` each run inside `UnitOfWork.runExclusively(ACTIVITY_SPECIALTY_LOCK)`
  (`application/service/activity-specialty-lock.ts`) and load inside it. Without that, a
  completion racing an edit of the same activity could save over the specialty the edit just gave
  it, from a stale load.
- **Reads carry the current specialty.** `readActivityCatalog()`
  (`application/service/activity-catalog.ts`) reads the catalog once per query. `PmPlanReader` and
  the history handler both use it. The history shows the activity's **current** specialty, not a
  snapshot: it cannot change while a PM plan holds the activity, so it is also the one the job was
  done under, and an activity completed later shows its new one.
- **Operating hours.** `OperatingHours` (`domain/value/operating-hours.vo.ts`) is 0 to
  `MAX_OPERATING_HOURS` (1,000,000), at most two decimals. It is optional when recording and never
  compared with an earlier execution's hours. The DTO asks the value object itself
  (`IsOperatingHours`, `infrastructure/http/is-operating-hours.validator.ts`, like
  `IsCalendarDate`), so whatever passes cannot throw a 500 in the controller. Don't swap it for
  `@IsNumber({ maxDecimalPlaces })`: that reads decimals from the number's text and throws on
  `1e-7`. `null` is read as absent (`@Transform`), never handed to `OperatingHours.of`. Column `maintenance_execution.operating_hours` is `numeric(9,2)`, nullable;
  Prisma reads it as a `Decimal`, which the repository converts. A job recorded without hours
  reads back `null`, never 0.
- **Test-only fixture.** `infrastructure/testing/MaintenanceTestingModule` serves
  `POST /api/testing/maintenance/legacy-activities` `{ name }` → 201 `{ id }`. It stores an activity
  without a specialty and records no event or audit entry. It needs no sign-in, sits outside
  the `Controllers` barrel, and is mounted by `AppModule` only at `NODE_ENV === 'test'`, beside
  framework's `TestingModule` (framework names no feature module). It is absent from the generated
  OpenAPI spec. `MaintenanceModule` exports `MaintenanceActivityRepository` for it alone.

No foreign key runs between aggregates (ADR 0004). The only relations are `pm_plan_item` →
`equipment` and `equipment_service_break` → `equipment` (both cascade), inside one aggregate.

## Schedule segments

`PmSchedule` (`domain/value/pm-schedule.vo.ts`) is an ordered list of segments
`{ startDueDate, intervalDays }`, stored as JSON in `pm_plan_item.schedule`. A segment generates
`startDueDate + k·intervalDays` up to, but not including, the next segment's start. Adding an item
creates one segment, and changing the interval appends one. Each later segment must start on a
due date of the previous segment, strictly after the previous segment's start.
`fromSegments()` throws a plain `Error` on a stored schedule that breaks this. A change starting on
the last segment's own start date **replaces** that segment.

**A restart segment** (issue #110) is the one exception: a row given a new first due date when its
equipment is reactivated gets `PmSchedule.restartedOn(day, firstDueDate)`, a segment carrying
`restartedOn` (the reactivation day) besides `startDueDate` and the interval in force. The previous
calendar stops on `restartedOn` — a segment's due dates run up to the day the next one **takes
over**, its `restartedOn` or else its `startDueDate` — and the restart's due dates start at
`startDueDate`, on or after that day, not necessarily on one of the previous segment's due dates.
Segments that had not **taken over** by the restart day give way (none left: a plain first
segment). A restart that took over but was overtaken before its first due date — its equipment
retired again first — **stays**: it is what stopped the calendar before it, so dropping it would
run that calendar again through days the restart covered. Every read measures from the take-over
day for the same reason (`occurrenceAfter` moves on to the first segment actually reached,
`dueDatesBetween` stops on a segment taking over after the range, never on a first due date). An
interval change from a restart's own first due date keeps it a restart. Stored in the same JSON,
with `"restartedOn": "YYYY-MM-DD"` only on such a segment; `fromSegments()` refuses a restart
taking over on or before the previous segment took over, or first due before its own restart day.
Every 7 days from 07/01, reactivated 07/20 with 07/25 → 07/25, 08/02 (no 07/22). Restarted 07/20
from 08/20, retired 07/25, restarted 08/10 from 08/12 → 07/01, 07/08, 07/15, 08/12, … (no 07/22);
continued instead at the second reactivation → 08/20 stays next.

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
the equipment history and the range reads carry it, the daily list does not. The daily list is each item's current
occurrence while it is `due` or `overdue`.

The range reads (`PmOccurrences.occurrencesDueIn` / `occurrencesPlacedIn`) list **every** occurrence
whose due date is in the range, future ones included (all of them, not just the next), each with its
status as of today by the table above.

- **Stop date.** A deactivated item stops on the Tehran date of `deactivatedAt` — the third
  constructor argument of `PmOccurrences`, which every method respects. Occurrences run up to and
  including it, none after. `occurrenceOn` a later date throws, and `currentOccurrence` is capped at
  it. `nextDueDate`/`intervalChangeStart` throw for a stopped item; that is unreachable, since the
  aggregate refuses work on it first and the write paths use `occurrencesInForceOf` (no stop date).
  The ones before it are judged unchanged, so an undone one turns `missed` once the schedule's next
  due date passes, even though that date is not itself generated. Every 7 days from 07/01, done
  07/01, today 07/20: deactivated 07/10 or 07/08 → 07/01 `on_time`, 07/08 `missed`; deactivated
  07/07 → only 07/01.
- **Service gaps** (issue #110). Each service break is a `ServiceGap` (fourth constructor argument):
  from the **day after** the Tehran date of `retiredAt` up to, **not including**, the Tehran date of
  `reactivatedAt` — or without end while still retired (`ServiceBreak.gap()`; reactivated on the
  retirement day or the day after, it leaves no gap). **The retirement day itself stays in
  service, as before issue #110**: retiring is like deactivating every row that day, so a due date
  on it is listed and, undone, turns `missed` (every 7 days from 07/03, retired 07/10, today 07/20
  → 07/03 and 07/10 `missed`). A due date inside a gap is **not generated** (not listed, not
  counted, not recordable) unless work was recorded for it anyway, done before the retirement
  (reviewer L2: recorded work is never dropped). A due date before a gap is judged as ever, against the schedule's next due date even when the gap
  swallowed it (07/08 below is `missed`), and once a gap has ended the current occurrence is never
  one before it, so such an occurrence is never recordable after reactivation (it reads `overdue`
  until its next due date if the gap was short, then `missed`). An open gap means the item takes no
  more work, like a stop date. `PmOccurrences.generatesOn(day)` is the one question "does this due
  date exist". `Equipment.occurrencesOf(item, executions)` builds the history view (deactivation
  stop + every gap); `occurrencesInForceOf` the in-force one (only the gaps that ended).
  `Equipment.stopDateOf(item)` still answers the last day in force — the Tehran date it was
  deactivated or its equipment retired, whichever is earlier. The approved example (Jalali months
  7–11 have 30 days): every 7 days from 07/01, retired 07/10–07/20 and 08/05–08/18 → 07/15, 08/06,
  08/13 not generated, next due 07/22 on reactivation, and done 07/01, 07/22, 07/29, 08/20 is 4 of 5
  → 80%.
- **Calendar date.** `PmOccurrence.calendarDate` is the Tehran date performed when `late`, the due
  date otherwise (an early on-time job stays on its due date). `occurrencesPlacedIn` returns two
  kinds of occurrence. First, those due in the range whose calendar date stays inside it. Second,
  from the executions, those done late inside the range while due before it. **Don't replace the
  second with a schedule window** such as "start at the occurrence `from` falls in". A late job is
  performed before the next due date *as the schedule stood when it was recorded*, but a later
  interval change can put any number of due dates in between. Take every 30 days from day 0, done
  late on day 10, then changed to 3 from day 0: the due dates become 0, 3, 6, 9, 12. That window
  lost the day-0 row in a month starting at day 10.
- The next due date an undone occurrence is judged against is computed lazily, only when today is
  past it, so a range far ahead never asks for a date it does not need.

**Next due date** = the occurrence an execution recorded now is for: the earliest due date on or
after the current occurrence that has no execution yet. So a missed occurrence can never be
recorded, and a job done early covers the upcoming date and moves the plan on. Recording is always
"now" (`Clock`) by the signed-in actor, with optional `notes` and `operatingHours`: no back-dating
and no other outcome.

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
| `equipment.name` | `EquipmentNameTaken` → `equipment-name-taken` (`name`) — retired equipment's included; deleted equipment's is free again |
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
pins the round trip of segments and deactivation (two inactive rows of one activity beside an active one), the audit entry, the date column, operating
hours (and their absence), an activity's specialty (and its absence until completed, one audit
entry), one audit entry for an edit changing name and specialty, and four of the five backstops
(all but the activity name). It also pins the PM schedule's execution reads:
`dueIn` (both bounds), `dueOrPerformedIn` at either Tehran midnight, `dueWithinOwnRanges` (each
item within its own range) and `performers()` (latest name, once each).

Each problem's `detail` is the Persian sentence the form shows (`exception.mapper.ts`).
`MaintenanceExceptionMapper` is registered in `framework/infrastructure/http/exception.filter.ts`.

## Known gap

- **Recording an execution does not lock the equipment.** The handler checks that the equipment is
  in service and the item is active, then saves only the execution. An execution can therefore
  commit after a concurrent retirement or deactivation that it raced. (It does hold
  `PM_SNAPSHOT_NAMES_LOCK`, so it cannot race a name correction — below.)

## System Admin exceptions (issue #110)

Design: `docs/superpowers/specs/2026-11-04-system-admin-dependency-exceptions-design.md`; the
pinned HTTP contract is in the plan beside it. Every new route is `@Roles(Role.SystemAdmin)` — a 403
for the Technical Manager and the PM inspector.

- **Correcting a name in use.** `PATCH /equipment/:id` and `PATCH /maintenance-activities/:id`
  take `applyToRelatedRecords?: boolean`. For a System Admin (resolved per request by the framework's
  `ApplyToRelatedRecordsResolver`) whose edit changes only the name —
  `Equipment.changesOnlyCorrectableFields()` (always), `MaintenanceActivity.changesOnlyCorrectableFields(specialty)`
  (the specialty kept) — the lock above does not apply, and
  `PrismaMaintenanceCorrectionPropagator` (`infrastructure/persistence/`) rewrites the snapshots by
  direct update in the edit's transaction: an equipment's name in `maintenance_execution.equipment_name`,
  an activity's in `pm_plan_item.activity_name` and `maintenance_execution.activity_name`. No event
  but the record's own `EquipmentRenamed`/`MaintenanceActivityEdited`. A correction of retired
  equipment goes through `Equipment.correctName()`, which skips `equipment-retired` and leaves it
  retired. Uniqueness is checked as ever, before anything is written.
- **One lock for the names.** `PM_SNAPSHOT_NAMES_LOCK` (`application/service/pm-snapshot-names-lock.ts`)
  is held by `RecordMaintenanceExecutionHandler` (which snapshots both names), `RenameEquipmentHandler`
  and `EditMaintenanceActivityHandler` (the latter after `ACTIVITY_SPECIALTY_LOCK`; nothing takes the
  two the other way round), through `UnitOfWork.runExclusively`. Without it an execution recorded
  while a correction runs could keep the old name.
- **Deleting executions.** `MaintenanceExecution.delete()` records `MaintenanceExecutionDeleted`;
  deleting all of a row's deletes each, oldest due date first, in one unit of work (one audit entry
  each). Two requests deleting one execution at once: the second's delete finds no row, which
  `PrismaMaintenanceExecutionRepository.delete()` turns from Prisma's P2025 into `EntityNotFound`
  (404, `persistence/record-not-found.ts`). Active or inactive row, in service or retired. Nothing else changes: the occurrence simply
  has no execution again — `overdue` and re-recordable before its next due date, `missed` from then.
- **Deleting an inactive row.** `Equipment.deletePlanItem(id)` refuses an active row
  (`PmPlanItemIsActive` → 409 `pm-plan-item-active`, «برای حذف ردیف فعال، ابتدا آن را غیرفعال
  کنید.») and records `PmPlanItemDeleted`; the handler deletes the row's executions with
  `MaintenanceExecutionRepository.deleteOfPlanItems()` (no events) in the same unit of work.
- **Deleting retired equipment.** `Equipment.delete()` refuses equipment in service
  (`EquipmentNotRetired` → 409 `equipment-not-retired`, «فقط تجهیز کنار گذاشته شده قابل حذف یا فعال
  سازی دوباره است.») and records `EquipmentDeleted`; the handler deletes every execution of the
  equipment — `deleteOfEquipment`, by `equipment_id`, not by the rows it loaded, so one recorded
  meanwhile is not orphaned — then the equipment (its rows and service breaks by cascade), in one unit of work. Issue #94's
  "no cascade" holds everywhere else. The name is free again, and the data leaves every read, past
  dashboard periods included.
- **Reactivating.** `Equipment.reactivate(now, rescheduled)` closes the open break (else
  `EquipmentNotRetired`). Each `{ planItemId, firstDueDate }` must be an active row of this
  equipment, named once (`InvalidReactivationItem` → 400 `invalid-reactivation-item`, «ردیف انتخاب
  شده در برنامه فعال این تجهیز نیست.»), with a first due date no earlier than the Tehran reactivation
  day (`ReactivationFirstDueDateInPast` → 400 `reactivation-first-due-date-in-past`, «اولین موعد تازه
  نمی تواند پیش از روز فعال سازی باشد.»); everything is checked before anything changes. A listed
  row gets a restart segment (above); every other active row continues its calendar; deactivated
  rows stay deactivated. Records `EquipmentReactivated` (with each rescheduled row's activity name and
  first due date).

**Persistence.** `equipment_service_break` (`equipment_id`, `position`, `retired_at`,
`reactivated_at`; key `(equipment_id, position)`) replaced `equipment.retired_at` in migration
`20261104060436_equipment_service_breaks`. Prisma drafted it as a bare `DROP COLUMN`, which would
have lost every retirement; it was amended at creation to copy each `retired_at` into an open break
(position 0) first. `PrismaEquipmentRepository.save()` persists the aggregate **whole**, as the
port states (reviewer M4): it deletes the plan rows this aggregate dropped — only those it loaded
and no longer holds, never a row another request added meanwhile — upserts the rest in plan order
with their new `position` (removals only move rows down, so ascending order never collides), and
rewrites the service breaks. Equipment the repository loaded is only ever **updated** (reviewer L1):
if another request deleted it meanwhile, the update finds no row and the save is `EntityNotFound`
(404), never a create bringing it back. The repository tracks what it loaded in a `WeakMap`, so a
new `Equipment` is created and a loaded one updated. `test/integration/system-admin-exceptions.int-spec.ts`
pins the cascade, the row deletion and renumbering, the service-break and restart round trip, the
refused save and the propagation.
