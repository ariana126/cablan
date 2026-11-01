# Technical management dashboard (issue #89) — design

## Capability

«داشبورد مدیریتی فنی» is a new page, first in the «فنی» menu, for the technical manager and the
system admin only. On one page it shows the PM state of today (due today, overdue, done today), the
missed occurrences of a chosen period, PM performance over that period (adherence, completion, on
time, late, average days late) with a daily/weekly trend, PM coverage of active equipment, the
equipment with the most current overdue work, the next seven days, and a follow-up table from which
due/overdue work can be recorded and the filtered rows exported to Excel.

Feature file: `acceptance-tests/specs/maintenance-management/technical-management-dashboard.feature`
— the stakeholder-approved proposal of issue #89, verbatim. Every «… داشبورد مدیریتی فنی را … مشاهده
می کند» is active voice, so the scenarios are **UI-voiced** (the page is the point); the «تلاش …»
access-denied outline is the backend's 403 (API door, as in every other feature); every `Given` is a
passive precondition (API). QA makes the final call per its own rules.

| Rule | Scenarios |
|---|---|
| Who may see it | مشاهده … توسط کاربر مجاز (UI), تلاش کاربر بدون دسترسی … (API 403) |
| Current state ignores the period | شاخص های وضعیت جاری در بازه های مختلف; موعدی که انجام نشده حساب شده دیگر عقب افتاده نیست |
| Missed counted by the day it became missed | موعد ازدست رفته در بازه های مختلف |
| Adherence / completion | ده موعد گذشته …; عملکرد تعویض روغن هفتگی …; کار عقب افتاده ای که …; کاری که با تاخیر … |
| Today and future excluded | دو کار با موعد امروز …; موعدی در لبه بازه 7 روز اخیر |
| Equipment filter | عملکرد و عقب افتادگی برای یک تجهیز |
| History survives deactivation / retirement | حذف فعالیت از برنامه تجهیز; کنار گذاشتن تجهیز |
| Coverage | four examples (50%, 75%, not-yet-due counts, «—» with no active equipment) |
| Most-overdue ranking | three examples |
| Next seven days | three examples |

## Decisions

- **Read side of the existing `maintenance` module; no new aggregate, nothing stored.** Every
  number is computed from `PmOccurrences` (the unchanged status calculator), the executions and
  today, exactly as the daily list and the range reads are. «حذف فعالیت» in the Gherkin is the
  existing deactivation (issue #91). Retired equipment and deactivated items keep their history up
  to the stop date (`Equipment.stopDateOf`), so past performance never changes when the plan does.
- **One endpoint**: `GET /pm-dashboard?periodDays=7|30|90&equipmentId=<uuid>` under
  `MAINTENANCE_PLANNER_ROLES` (SystemAdmin, TechnicalManager — exactly the dashboard's roles; the PM
  inspector gets a 403). `periodDays` defaults to 30; anything else is the ordinary 400
  `validation-error`; an unknown `equipmentId` is the framework's existing entity-not-found 404. One
  request per refresh keeps every panel consistent with one "today".
- **Definitions** (T = today in Tehran, period = `[T − (periodDays − 1), T]`):
  - *current*: `dueToday` = active items' (non-retired equipment, non-deactivated item) occurrences
    with status `due`; `overdue` = status `overdue`; `doneToday` = executions whose Tehran
    performed date is T, whatever their due date. Not affected by the period.
  - *missed*: occurrences with status `missed` whose **missedOn** — the next due date of the
    schedule after them, the day they turned missed — lies in the period.
  - *performance*: occurrences whose **due date** is in `[periodFrom, T − 1]` (today and the future
    are excluded). `considered` = all of them; `onTime`/`late` by status; `notDone` = overdue +
    missed. `adherencePercent = round(100·onTime/considered)`, `completionPercent =
    round(100·(onTime+late)/considered)`, both `null` when `considered = 0` («داده کافی وجود ندارد»).
    `averageDaysLate` = mean `daysLate` of the late ones, one decimal, `null` when none.
  - *trend*: the same rule per bucket — one bucket per day of `[periodFrom, T − 1]`, and weekly
    buckets of 7 days counted back from T − 1 (the oldest may be shorter, clipped at `periodFrom`).
  - *coverage*: plant-wide, ignores `equipmentId`. Active equipment = not retired; with a plan = at
    least one active (non-deactivated) item, even if its first due date is ahead. Percent `null`
    when there is no active equipment («—»).
  - *most overdue*: per equipment, its `overdue` occurrences (missed ones excluded), count and sum of
    `daysOverdue`; only equipment with ≥ 1; ordered count desc, sum desc, then name (`byPersianName`).
  - *upcoming*: active items' occurrences due in `[T + 1, T + 7]` with status `upcoming` (one
    recorded early is `on_time` and so drops out), ordered by due date, equipment name, plan order.
  - *occurrences* (the follow-up table): every occurrence the panels above count — due in
    `[periodFrom, T + 7]`, plus each item's occurrence just before `periodFrom` when it is currently
    `overdue` or turned `missed` inside the period, plus any occurrence done today. Each row says
    whether it is `recordable` (status `due`/`overdue`, item active, equipment in service).
- **Recording from the dashboard reuses `POST /equipment/:id/pm-plan-items/:itemId/executions`**
  with its existing rules and roles, then refreshes the dashboard. No new write.
- **Filters**: period and equipment are server parameters; status and free-text search (equipment
  or activity name) filter the follow-up table on the client. Cards, chart points, the coverage
  donut and the overdue-equipment rows are clickable and set the table's filter (and, for
  "without plan", list the equipment with a link to its technical file `/pm-plans/:id`).
- **Frontend**: lazy route `/pm-dashboard`, title «داشبورد مدیریتی فنی · کابلان», `<h1>` «داشبورد
  مدیریتی فنی», first page of the «فنی» category, roles SystemAdmin + TechnicalManager. Jalali
  dates, Material components, design tokens, responsive grid, last-updated time and a refresh
  button, an empty-state message per panel. Home-page shortcuts are **not** changed (the home
  feature pins them exactly).

## Risks

- The PM inspector already reaches every other maintenance read; the 403 here comes from the planner
  role list, and `route-roles.spec.ts` must keep passing.
- Per-item windows rather than whole-history walks keep the read bounded, as the range reads do.
- The 20-equipment coverage example and the 10-occurrence performance example need bulky API
  preconditions; QA keeps them in fixtures.
- Charts: prefer a maintained library only if it passes `lint-styles` (tokens only) and the axe gate
  in both colour schemes; otherwise a small SVG component, with the reason stated.
