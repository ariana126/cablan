# PM plan item deactivation — design (issue #91)

## Capability

In an equipment's technical file («پرونده فنی تجهیزات», `/pm-plans/:equipmentId`) the planner no
longer *removes* an activity from the PM plan: they **deactivate** the plan row. A deactivated row
leaves the active plan, the daily list and every future due date, keeps its schedule and all its
executions, and is listed read-only, with its last interval, first due date and the Jalali date and
time it was deactivated, in a separate «فعالیت‌های غیرفعال» part of the folder. It can never be
reactivated, re-scheduled or executed again. The same catalog activity may be added again later as a
brand-new, independent row. Deactivation only concerns the plan row, never the catalog activity.

## Scenarios (`acceptance-tests/specs/maintenance-management/planning-preventive-maintenance.feature`)

Added or changed by the approved proposal (issue comment `cablan:gherkin-proposal`):

- `تلاش کاربر بدون دسترسی برای غیرفعال کردن فعالیت در برنامه تجهیز` (outline, 4 users)
- `افزودن دوباره فعالیتی که در برنامه همان تجهیز غیرفعال شده است` — **UI-voiced** (the add step)
- `چند بار افزودن و غیرفعال کردن یک فعالیت در برنامه یک تجهیز`
- `حذف فعالیت از برنامه تجهیز` (now deactivates) — **UI-voiced** (the deactivate step)
- `غیرفعال کردن فعالیت در یک تجهیز روی برنامه همان فعالیت در تجهیز دیگر اثری ندارد` — **UI-voiced**
- `غیرفعال کردن تعویض روغن اکسترودر 1` — **UI-voiced**, reads the inactive list
- `تجهیزی که همه فعالیت هایش غیرفعال شده است` — **UI-voiced**
- `تلاش برای فعال کردن دوباره فعالیت غیرفعال شده`, `تلاش برای تغییر دوره فعالیت غیرفعال شده`,
  `تلاش برای ثبت انجام فعالیت غیرفعال شده` — "tries to" voice, API.

Rules renamed: «در هر لحظه فقط یک ردیف فعال از هر فعالیت…» and «فعالیتی که از برنامه غیرفعال
شده…». `pm-schedule-overview.feature`'s «حذف شده» rule was not part of the proposal and keeps its
wording; its "removed on day X" precondition is now carried out by deactivating.

## Decisions

- **Behaviour on the existing aggregate, no new module, no new table.** The soft stop already exists
  (`PmPlanItem.removedAt`, the partial unique index `WHERE removed_at IS NULL`, stop dates in
  `PmOccurrences`). It is renamed into the new ubiquitous language: `deactivatedAt`,
  `Equipment.deactivatePlanItem()`, event `PmPlanItemDeactivated`, exception
  `PmPlanItemIsDeactivated`. The Prisma field becomes `deactivatedAt @map("removed_at")` — **no
  migration**, the column and its partial index stay as they are.
- **HTTP.** `DELETE /equipment/:id/pm-plan-items/:itemId` is removed (no permanent deletion, not
  even soft under that verb). It becomes `POST /equipment/:id/pm-plan-items/:itemId/deactivation` →
  204, planner roles (SystemAdmin, TechnicalManager), the same rules as the old removal (404 unknown
  equipment/item, 409 `equipment-retired`). **There is no reactivation route**; any attempt (e.g.
  `DELETE …/deactivation`) is a 404. Deactivating, changing the interval of, or recording an
  execution on a deactivated row is a 409 `pm-plan-item-deactivated` (replaces
  `pm-plan-item-removed`), detail «این فعالیت در برنامهٔ تجهیز غیرفعال شده است.».
- **Read model.** `GET /equipment/:id` keeps `planItems` (active) and adds `inactivePlanItems`:
  `{ id, activityId, activityName, intervalDays, firstDueDate, deactivatedAt }` — `intervalDays` the
  last segment's, `firstDueDate` the schedule's first, `deactivatedAt` an ISO instant. Ordered by
  `deactivatedAt` ascending, ties by plan order. Served for retired equipment too.
- **Re-adding** is already legal (the index is partial); the new row has its own id and schedule,
  and the history of the old row is untouched. Several inactive rows of one activity are allowed.
- **Audit** line wording moves to «غیرفعال‌سازی».
- **UI.** Row menu «حذف» → «غیرفعال‌سازی»; confirm dialog heading «غیرفعال‌سازی فعالیت در برنامه»,
  button «غیرفعال‌سازی», body says the history is kept and it cannot be reactivated. A read-only
  «فعالیت‌های غیرفعال» table (columns «فعالیت», «دوره (روز)», «اولین موعد», «زمان غیرفعال شدن»,
  Jalali `yyyy/MM/dd HH:mm`, Tehran time) in the folder, with an empty note. The board already
  lists every equipment, so a folder with no active row stays reachable.
- Synchronous, no new async path.

## Risks

- Renaming touches audit-logging's handler and the frontend's error mapping; a missed rename shows up
  as a stale problem type.
- «اکنون … ساعت …» needs the test stack's `TunableClock` set to an instant, not just a date.
