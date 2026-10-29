# Maintenance management (CMMS, phase 1) — design

Issue #69. Approved Gherkin: `acceptance-tests/specs/maintenance-management/*.feature` (five files),
plus two edits to existing files: the `ثبت کاربر با نقش معتبر` outline gains `مدیر فنی` and
`بازرس PM`, and every existing `تلاش کاربر بدون دسترسی …` outline's examples gain `مسلمی` and
`رضازاده` (assumption 4 of the approved proposal: the two new roles reach nothing outside
maintenance).

## Capability

A technical manager (`مدیر فنی`, persona رضازاده) registers equipment by name and a reusable catalog
of maintenance activities, and gives each piece of equipment a calendar-based preventive-maintenance
(PM) plan: activity + interval in days + first due date. The system derives every due date from that
plan, shows a PM inspector (`بازرس PM`, persona مسلمی) the daily list of due and overdue work, lets
them record that a job was done, and keeps a maintenance history and an overall status view
(on time / late / missed) that later plan changes never rewrite.

## Scenarios

| Feature file | Scenarios |
|---|---|
| `registring-equipment.feature` | ثبت تجهیز جدید فقط با نام · ویرایش نام تجهیز · ثبت تجهیز توسط کاربر مجاز · تلاش کاربر بدون دسترسی برای ثبت/ویرایش تجهیز · ثبت تجهیز بدون نام · پاک کردن نام تجهیز · ثبت تجهیز با نام تکراری · ویرایش نام تجهیز به نامی تکراری |
| `registring-maintenance-activity.feature` | ثبت فعالیت جدید · ویرایش نام فعالیت · تلاش کاربر بدون دسترسی برای ثبت/ویرایش فعالیت · ثبت فعالیت بدون نام · ثبت/ویرایش فعالیت با نام تکراری |
| `planning-preventive-maintenance.feature` | افزودن فعالیت به برنامه تجهیز · تلاش کاربر بدون دسترسی … · افزودن بدون دوره/اولین موعد · دو دوره متفاوت برای دو تجهیز · افزودن دوباره یک فعالیت · برنامه بر اساس ساعت کارکرد · موعد بعدی پس از انجام · انجام زودتر از موعد · کوتاه کردن دوره · سابقه انجام پس از تغییر دوره · حذف فعالیت از برنامه · کنار گذاشتن تجهیز |
| `daily-pm-schedule.feature` | برنامه روزانه با کار سررسیده، عقب افتاده و آینده · تعویض روغن انجام شده امروز · آخرین روز پیش از موعد بعدی · رسیدن موعد بعدی · تلاش بدون دسترسی برای برنامه روزانه / برنامه کلی |
| `recording-maintenance-execution.feature` | ثبت انجام با توضیحات · ثبت انجام بدون توضیحات · ثبت انجام توسط کاربر مجاز · تلاش بدون دسترسی · وضعیت موعد بر اساس روز ثبت انجام · موعدی که تا موعد بعدی انجام نشده · ثبت انجام پس از رسیدن موعد بعدی |

**UI-voiced:** the plain-voice actions (`… ثبت می کند`, `… تغییر می دهد`, `… مشاهده می کند`,
`… اضافه می کند`, `… حذف می کند`, `… کنار می گذارد`) are the browser's; every `تلاش می کند …`
and every precondition is HTTP. The exact door per step is QA's call under
`acceptance-tests/CLAUDE.md`. Either way the feature ships a full UI.

## Decisions

**One new backend module, `maintenance`** (`backend/src/modules/maintenance/`). Nothing existing
models equipment or schedules; putting it in its own module keeps the BOM modules untouched and the
dependency-cruiser rules simple.

**Aggregates.**
- `Equipment` — `name` (non-empty, trimmed, unique), `retiredAt` (nullable), and **owns its PM plan
  items**. Owning them makes "one activity at most once in an equipment's plan" an invariant of one
  aggregate, and retiring equipment stops its whole plan in one transaction.
- `MaintenanceActivity` — `name` (non-empty, trimmed, unique). Catalog only.
- `PmPlanItem` (entity inside `Equipment`) — `activityId`, `removedAt` (nullable), and a
  **schedule**: an ordered list of segments `{ startDueDate, intervalDays }`.
- `MaintenanceExecution` — its own aggregate: `equipmentId`, `planItemId`, `activityId`,
  `activityName` (snapshot), `dueDate`, `performedAt`, `performedById`, `notes` (optional). It is the
  history, so it never refers back to the schedule for its meaning: on time / late is derived from
  its own `dueDate` and `performedAt`.

**The schedule (pure domain).** Due dates of a segment are `startDueDate + k·intervalDays`; a
segment covers due dates strictly before the next segment's `startDueDate`. Adding an item creates
one segment `{ firstDueDate, intervalDays }`. Changing the interval on day T appends a segment whose
`startDueDate` is the **current occurrence** — the latest due date ≤ T (or the first due date if
T is before it) — with the new interval. So `30 → 15` on 07/10 after due 07/01 gives 07/01, 07/16;
past occurrences are still generated from the old segment, so their statuses never move. No missed
occurrence is ever materialized: missed-ness is computed.

For an occurrence `dₖ` (next occurrence `dₖ₊₁`) and today T:

| Executed? | T | Status |
|---|---|---|
| yes, performed date ≤ dₖ | — | `on_time` (بموقع) |
| yes, performed date > dₖ | — | `late` (با تاخیر) |
| no | T ≥ dₖ₊₁ | `missed` (انجام نشده) |
| no | dₖ < T < dₖ₊₁ | `overdue` (عقب افتاده), `daysOverdue = T − dₖ` |
| no | T = dₖ | `due` (سررسیده), `daysOverdue = 0` |
| no | T < dₖ | `upcoming` |

**Recording an execution targets** the earliest occurrence with due date ≥ the current occurrence
that has no execution yet. Recording on 06/29 for first due 07/01 hits 07/01 (on time); on 07/08
it hits 07/08 and 07/01 stays missed; a missed occurrence can never be recorded. Recording is always
"now" (`Clock`) by the signed-in actor — no back-dating, no other outcome than done (stakeholder
answer 5). **Next due date** = the due date of that same target occurrence.

**"Today"** is the `Asia/Tehran` calendar date of `Clock.now()`; dates cross HTTP as ISO
`YYYY-MM-DD` (Gregorian) and the frontend shows them in Jalali. The test clock endpoint the suite
already uses for `اکنون …` steps drives it.

**Usage-based intervals are modelled, not implemented.** The add-item body carries
`intervalUnit: 'days' | 'operating_hours'`; the domain rejects `operating_hours` with
`usage-based-interval-not-supported`. The issue asks the structure to allow both; the stakeholder
says the user may not define one yet.

**Removing an item / retiring equipment** is a soft stop (`removedAt` / `retiredAt`): it leaves the
daily list and the overview, its executions stay in the equipment's history.

**Roles.** Identity gains `technical_manager` (مدیر فنی) and `pm_inspector` (بازرس PM).

| Capability | system_admin | technical_manager | pm_inspector | others |
|---|---|---|---|---|
| Equipment, activities, PM plans (read + write), retire | ✓ | ✓ | — | — |
| Daily list, overview, record execution, equipment history | ✓ | ✓ | ✓ | — |
| Every existing BOM / product / material / component endpoint, reads included | as today | — | — | as today |

The last row is the stakeholder's "these two roles have no access to the other sections": the
existing role-free (`JwtAuthGuard`-only) reads get an explicit `@Roles` listing the four existing
roles. Identity's own session endpoints stay open to every signed-in user.

**HTTP surface** (field names pinned in the plan): `equipment`, `maintenance-activities`,
`equipment/:id/pm-plan-items`, `…/executions`, `pm-schedule/daily`, `pm-schedule/overview`,
`equipment/:id/maintenance-history`. All synchronous, CQRS commands + queries, audited like every
other aggregate change (ADR 0007).

**UI.** Under the existing `اطلاعات پایه` category: `تجهیزات / دستگاه` (list, add, rename, retire)
and `فعالیت های تعمیرات و نگهداری` (list, add, rename). A new top-level category `فنی`:
`برنامه PM تجهیزات` (pick equipment, add / change interval / remove plan items, see its history),
`برنامه روزانه PM` (today's due/overdue rows with days overdue and a «ثبت انجام» action with optional
notes) and `وضعیت تعمیرات و نگهداری` (the overview: every occurrence so far with its status, who and
when). Visibility comes from `navigation.ts` as for every page.

## Risks

- **Timezone.** Due dates are dates, `performedAt` is an instant; comparing them in UTC would make a
  late-evening Tehran execution land on the wrong day. Every date comparison goes through one
  "Tehran date of instant" helper.
- **Restricting existing reads** could break an existing scenario that reads as a role nobody
  expected; the existing outlines only use the four old personas, so the risk is low, and the
  guardrails cover it.
- **Ordering of the daily list.** The Gherkin table lists rows in plan order; the API orders by
  equipment name, then the order items were added to the plan.
