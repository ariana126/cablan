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
| `GET /equipment` | planner | `ListEquipmentHandler` (retired included, `retired` flag; `activePlanItemCount`, deactivated items excluded) |
| `GET /equipment/:id` | planner | `GetEquipmentHandler` (`planItems`: active, with `nextDueDate`; `inactivePlanItems`: deactivated, read-only — retired equipment included) |
| `GET /equipment/:id/maintenance-history` | **schedule** | `GetEquipmentMaintenanceHistoryHandler` (newest first; each row's `activitySpecialty`, current, and `operatingHours`) |
| `POST /maintenance-activities` | planner | `RegisterMaintenanceActivityHandler` → 201 `{ id }`; body `{ name, specialty }`, both required |
| `PATCH /maintenance-activities/:id` | planner | `EditMaintenanceActivityHandler` → 204; body `{ name, specialty }` |
| `GET /maintenance-activities` | planner | `ListMaintenanceActivitiesHandler` (`{ id, name, specialty }`, `specialty` null while missing) |
| `GET /maintenance-activities/unassigned-specialties` | **SystemAdmin** | `ListActivitiesWithoutSpecialtyHandler` → `{ id, name }[]` by Persian name (see [Specialties](#specialties-and-operating-hours)) |
| `POST /maintenance-activities/specialty-assignment` | **SystemAdmin** | `CompleteMissingSpecialtiesHandler` → 204; body `{ assignments: { activityId, specialty }[] }` |
| `POST /equipment/:id/pm-plan-items` | planner | `AddPmPlanItemHandler` → 201 `{ id }` |
| `PATCH /equipment/:id/pm-plan-items/:itemId` | planner | `ChangePmPlanItemIntervalHandler` → 204 |
| `POST /equipment/:id/pm-plan-items/:itemId/deactivation` | planner | `DeactivatePmPlanItemHandler` → 204 (issue #91; no `DELETE`, no reactivation route) |
| `POST /equipment/:id/pm-plan-items/:itemId/executions` | **schedule** | `RecordMaintenanceExecutionHandler` → 201 `{ id, dueDate }`; body `{ notes?, operatingHours? }` |
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
  force, with no stop date, so the detail still shows a retired equipment's next due dates.
- `named(items)` gives items their current activity names with no occurrences — the detail's
  `inactivePlanItems`. It is a second catalog read for that one query (skipped when there are none).
- `readWithHistory(equipment, include, executionsOf)` serves the range reads. It gives every item,
  deactivated ones included, each with its stop date in its `PmOccurrences`, and loads only the
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
survives up to `Equipment.stopDateOf`) is read over its `dueDateWindowOf`. Its executions are loaded
first — `MaintenanceExecutionRepository.dueWithinOwnRanges` (each item's executions due within its
own range, one `OR` query) plus `dueOrPerformedIn(ids, [today, today])` for jobs performed today,
whatever their due date — and handed to `readWithHistory`. Any occurrence done today outside the
window is added (one past the item's stop date cannot be built and is skipped). "Current"
due/overdue, the ranking and upcoming count active items only; `doneToday`, missed and performance
count history too.

## Aggregates

- **`Equipment`** — a unique, trimmed `name` and `retiredAt`. It **owns its `PmPlanItem`s**, so
  "one activity at most once among an equipment's active items" is a single-aggregate invariant.
  Retiring is a soft stop (never deleted, the name stays taken). After that every write on it is a
  409 `equipment-retired`: a rename, adding an item, changing an interval, deactivating an item or
  recording an execution.
- **`PmPlanItem`** (entity inside `Equipment`) — `activityId`, a snapshot `activityName` (for the
  audit lines; reads show the activity's **current** name), a `PmSchedule` and `deactivatedAt` (column `removed_at`, from before issue #91 renamed removal to
  deactivation — no migration, so the hand-added partial index below still names it). It is
  deactivated, never deleted, because executions name its id. A deactivated item is a 409
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
any plan item — active or deactivated alike — cannot be edited, not even by System Admin: 409
`record-has-dependents`, kind `equipment-pm-plan`, named by the equipment (for an equipment, itself).
For an activity that covers its name and its specialty alike, a specialty-only edit included. The
one exception is completing a missing specialty, below.
`RenameEquipmentHandler`/`EditMaintenanceActivityHandler` call the framework's
`RecordDependencies` right after loading the record, so for retired equipment that has plan items
this 409 comes before `equipment-retired`. Plan items are never deleted and every execution hangs
off one, so they cover the execution history too. `PrismaMaintenanceDependentsProbe`
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
the equipment history and the range reads carry it, the daily list does not. The daily list is each item's current
occurrence while it is `due` or `overdue`.

The range reads (`PmOccurrences.occurrencesDueIn` / `occurrencesPlacedIn`) list **every** occurrence
whose due date is in the range, future ones included (all of them, not just the next), each with its
status as of today by the table above.

- **Stop date.** A deactivated item, or every item of retired equipment, stops at
  `Equipment.stopDateOf(item)`: the Tehran date of `deactivatedAt` or `retiredAt`, whichever is earlier.
  It is the third constructor argument of `PmOccurrences`, and every method respects it. Occurrences
  run up to and including it, none after. `occurrenceOn` a later date throws, and
  `currentOccurrence` is capped at it. `nextDueDate`/`intervalChangeStart` throw for a stopped item;
  that is unreachable, since the aggregate refuses work on it first and the write paths construct it
  without a stop date. The ones before it are judged unchanged, so an
  undone one turns `missed` once the schedule's next due date passes, even though that date is not
  itself generated. Every 7 days from 07/01, done 07/01, today 07/20: deactivated 07/10 or 07/08 →
  07/01 `on_time`, 07/08 `missed`; deactivated 07/07 → only 07/01.
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
  commit after a concurrent retirement or deactivation that it raced.
