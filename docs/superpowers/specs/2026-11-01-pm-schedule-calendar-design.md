# PM schedule: calendar and table views (issue #90) — design

## Capability

«گزارش PM» (`/pm-schedule/overview`) becomes «برنامه PM»: one page that shows every PM occurrence
in any date range, past or future. It has two views: a Jalali month **calendar** (the default) and a
**table** with a required due-date range. Four filters sit above both: equipment, activity, status
and performer. The history of removed plan items and retired equipment stays on the page, up to and
including the day they stopped.

Feature file: `acceptance-tests/specs/maintenance-management/pm-schedule-overview.feature` (the
approved proposal of issue #90, verbatim). Scenarios:

| Scenario | Voice |
|---|---|
| برنامه یک ماه که بخشی از آن هنوز نرسیده است | UI (table view, range) |
| روز شروع و روز پایان بازه هم جزو بازه هستند | UI |
| برنامه چند ماه جلوتر در تقویم | **UI** (calendar) |
| موعدی که با تاخیر انجام شده در بازه های مختلف | UI |
| مشاهده برنامه کلی با بازه نامعتبر («تلاش …») | API — 400 `invalid-pm-schedule-range` |
| کار انجام شده با تاخیر در تقویم | **UI** (calendar + details dialog) |
| موعد انجام نشده در تقویم | **UI** (calendar) |
| سوابق فعالیت حذف شده در برنامه کلی | UI |
| سوابق تجهیز کنار گذاشته شده در برنامه کلی | UI (equipment filter) |
| برنامه کلی برای یک انجام دهنده | UI (performer filter) |

QA chooses the final door for each scenario by its own rules. The voice above is the default.

## Decisions

- **The change sits on the existing read side; there is no new aggregate.** The rules are computed,
  never stored, and `PmOccurrences` keeps every status, delay and next-due rule as it is. What
  changes is *which* occurrences a read generates:
  - every occurrence whose **due date lies in `[from, to]`** (both ends inclusive), including
    future ones. The old rule stopped at the next occurrence not yet reached;
  - plan items that were **removed**, and equipment that was **retired**, are included. Their
    occurrences end at the **stop date**: the Tehran date of `removedAt` or `retiredAt`, whichever
    is earlier, inclusive. Nothing is generated after it;
  - each occurrence's status comes from the unchanged calculator, as of today. So an occurrence
    before the stop that was never done becomes `missed` once the schedule's next due date passes,
    even though that next date is not itself generated.
- **Where a row sits in the calendar** is a read-model field, computed once on the backend so both
  views use one rule: `calendarDate` is the Tehran date of `performedAt` when the status is `late`,
  and the `dueDate` otherwise.
- **Two range reads, one row shape.**
  - `GET /pm-schedule/overview?from&to&…filters` returns rows whose `dueDate` is in `[from, to]`
    (the table).
  - `GET /pm-schedule/calendar?from&to&…filters` returns rows whose `calendarDate` is in
    `[from, to]` (the calendar). The frontend sends the Gregorian bounds of the Jalali month shown.
  - Both require `from` and `to`. A missing one, or `from` after `to`, is a **400
    `invalid-pm-schedule-range`**. A malformed date is the framework's ordinary validation 400.
  - Each read generates only the occurrences its range needs (a window per item, not the whole
    history), so a large range never loads more than it shows.
- **Filters run on the server.** They are query parameters, all optional and combinable:
  `equipmentId`, `activityId`, `status` (a `PmOccurrenceStatus`) and `performedById` (the
  performer's user id, not the display name). A performer filter leaves out rows nobody has done;
  with no performer filter, every row is returned.
- **Filter options** come from `GET /pm-schedule/filter-options`, under the schedule roles: every
  piece of equipment (retired included, and flagged as such), every catalog activity, and every
  distinct performer found in an execution. `GET /equipment` and `GET /maintenance-activities` are
  planner-only, so the PM inspector cannot use them.
- **Roles are unchanged** (`PM_SCHEDULE_ROLES`). Guards run before validation, so a forbidden user
  gets a 403 whatever the range. The daily list, the equipment detail, the history and the PM-plans
  board are untouched.
- **The route stays** `/pm-schedule/overview`. The title, menu entry, breadcrumb and tab title
  become «برنامه PM». The home-page shortcut keeps its label «وضعیت تعمیرات و نگهداری», because
  `specs/home/role-based-home-page.feature` pins it and the approved proposal changes no existing
  scenario.

## UI

- A header «برنامه PM» and a view switch (`mat-button-toggle-group`, «تقویم PM» | «جدول PM»), with
  the calendar first. The view, the filters and the table range live in the page's state, so
  switching views keeps them.
- A shared filter bar: four `mat-select`s labelled «تجهیز», «فعالیت», «وضعیت» and «انجام دهنده»,
  each with a «همه» option, and a «پاک کردن فیلترها» button. Retired equipment is marked in its
  option.
- The table view has «از تاریخ» and «تا تاریخ» Jalali datepickers, defaulting to the current Jalali
  month, and a «ماه جاری» reset. Both dates are required and the start cannot be after the end; the
  errors show inline and no request is sent. The columns stay as they are today: تجهیز، فعالیت،
  موعد، وضعیت، مقدار تاخیر، انجام دهنده، زمان انجام.
- The calendar view is a Jalali month grid (Saturday first, RTL) with «ماه قبل», «ماه بعد» and
  «امروز», and today is marked. Each day lists its occurrences as chips showing equipment · activity,
  a status colour **and** the status word. A day shows at most three chips, then «+N مورد دیگر»,
  which opens the day's full list in a dialog. Clicking a chip opens the details dialog: equipment,
  activity, original due date, time performed, status, delay, performer and notes («—» when
  absent). Both views have loading, empty and error states.

## Risks

- Existing scenarios use «برنامه کلی … را مشاهده می کند» with no range. QA maps them to the page's
  default (the current month) or to an API range that covers the scenario's dates.
- The browser must compute Jalali month bounds in one helper, or the calendar and the table will
  drift apart.
