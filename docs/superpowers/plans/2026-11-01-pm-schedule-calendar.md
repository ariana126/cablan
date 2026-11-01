# PM schedule: calendar and table views (issue #90) — plan

Design: `docs/superpowers/specs/2026-11-01-pm-schedule-calendar-design.md`.

## HTTP contract (pinned)

Every route is under `PM_SCHEDULE_ROLES`.

`GET /pm-schedule/overview` and `GET /pm-schedule/calendar` take these query parameters:

| Param | Required | Notes |
|---|---|---|
| `from` | yes | ISO `YYYY-MM-DD`, inclusive |
| `to` | yes | ISO `YYYY-MM-DD`, inclusive |
| `equipmentId` | no | uuid |
| `activityId` | no | uuid |
| `status` | no | `on_time` \| `late` \| `missed` \| `overdue` \| `due` \| `upcoming` |
| `performedById` | no | user id |

A missing `from` or `to`, or `from` after `to`, is a 400 `application/problem+json` with type slug
`invalid-pm-schedule-range` and a Persian `detail`. The overview filters on `dueDate` in the range,
the calendar on `calendarDate` in the range. Rows are ordered by equipment name (`byPersianName`),
then plan order, then due date.

Each row is a `PmOccurrence`; both routes answer 200 with `PmOccurrence[]`:

```
equipmentId: string
equipmentName: string
equipmentRetired: boolean
planItemId: string
activityId: string
activityName: string        // current catalog name
dueDate: string             // ISO date
calendarDate: string        // ISO date: the Tehran date performed if late, else dueDate
status: PmOccurrenceStatus
performedAt: string | null  // ISO instant
performedById: string | null
performedBy: string | null  // display-name snapshot
daysLate: number | null     // only when late
notes: string | null
```

`GET /pm-schedule/filter-options` answers 200 with:

```
{ equipment: { id, name, retired }[],   // all of it, by name
  activities: { id, name }[],           // the whole catalog, by name
  performers: { id, name }[] }          // distinct performers of any execution, by name
```

## QA tasks

1. Write the business flow for every scenario in `pm-schedule-overview.feature`. Steps that another
   feature already defines (e.g. «اکسترودر 1 در سیستم ثبت شده باشد», «امروز … باشد», the plan-item
   precondition) are reused, not redefined.
2. Add the new preconditions: an execution recorded for a due date on a given day (by an unnamed
   actor or a named one), a plan item removed on a given day, and equipment retired on a given day.
   All of them go through the API and move the clock first.
3. Update the existing steps that read `GET pm-schedule/overview` so they pass a range. The existing
   no-range UI step «… برنامه کلی … را مشاهده می کند» opens the page (now the calendar by default)
   and either switches to «جدول PM» with its default month range or sets a range that covers the
   scenario's dates.
4. Update `ui/pm-overview-page.ts`: the heading «برنامه PM», the view toggle, the filter selects, the
   range fields, the calendar grid, the day list and the details dialog (mark each `ASSUMPTION`).
5. Automate the invalid-range outline over the API: 400 `invalid-pm-schedule-range`.

## Backend tasks

1. Domain: a range generator on `PmSchedule`/`PmOccurrences`. It yields the occurrences whose due
   date is in `[from, to]`, optionally capped at a stop date, with statuses from the existing
   `occurrence()` rule.
2. Application: `GetPmScheduleOverviewQuery(range, filters)`, `GetPmScheduleCalendarQuery(range,
   filters)` and `GetPmScheduleFilterOptionsQuery`. `PmPlanReader` reads every item, active and
   removed, of every piece of equipment, with its stop date. Add an `InvalidPmScheduleRange`
   exception.
3. Infrastructure: the query DTO, the controller routes, the schemas and the exception mapping.
   Regenerate the OpenAPI spec.
4. Unit tests for the range bounds, future occurrences, stop dates (before, on and after a due
   date), calendar placement and each filter, plus a check that the daily list is unchanged.

## Frontend tasks

1. Gateway methods for the three reads, and Jalali month helpers (the bounds of a month, the current
   month).
2. The page `/pm-schedule/overview`, titled «برنامه PM» in the route title, the menu and the
   breadcrumb. The home shortcut keeps its label.
3. The view toggle, the shared filters, the table view with its range form, and the calendar view
   with its day-overflow dialog and details dialog. Loading, empty and error states; a responsive
   layout; an accessibility audit of both views.
