# Activity specialty, PM navigation and operating hours — design

Issue #108. Approved Gherkin (rules added 2026-11-03) in
`acceptance-tests/specs/maintenance-management/`: `registring-maintenance-activity.feature`,
`recording-maintenance-execution.feature`, `pm-schedule-overview.feature`.

## Capability

Every maintenance activity carries exactly one **specialty**: electrical («برق») or mechanical
(«مکانیک»). The specialty groups and filters PM work everywhere it appears. Recording an execution
can optionally carry the equipment's **operating hours** since that activity was last done on it.

## Scenarios

`registring-maintenance-activity.feature`
- ثبت فعالیت جدید *(changed: now with specialty)*
- تغییر تخصص فعالیت *(new)*
- ثبت فعالیت بدون یک تخصص مشخص *(new outline: none / both)*
- ثبت فعالیت با نام تکراری *(changed)*
- تلاش برای تغییر تخصص فعالیتی که در برنامه PM آمده است *(new outline)*
- تعیین تخصص همه فعالیت های قبلی, تعیین تخصص فقط بخشی از فعالیت های قبلی,
  تخصص فعالیت قبلی پس از تعیین دیگر تغییر نمی کند, تلاش کاربری غیر از مدیر سیستم برای تعیین
  تخصص فعالیت های قبلی *(new: legacy assignment)*

`recording-maintenance-execution.feature`
- ثبت انجام با ساعت کارکرد یا بدون آن, ثبت انجام با ساعت کارکرد نامعتبر,
  ساعت کارکرد کمتر از نوبت قبلی پذیرفته می شود *(new)*

`pm-schedule-overview.feature`
- برنامه کلی برای یک تخصص و یک انجام دهنده, فیلتر تخصص در تقویم *(new)*

QA picks the door for each step by grammatical voice (see `acceptance-tests/CLAUDE.md`). The UI
exists for all of these scenarios, so any of them can be driven through the browser.

Display-only changes with no scenario (issue sections 1, 3, 5):
- a «گزارشات» folder in the «فنی» menu that holds the dashboard;
- the daily PM list grouped by equipment, then by specialty;
- the equipment folder's plan items and inactive items grouped by specialty.

## Decisions

- **Specialty is a field of the existing `MaintenanceActivity` aggregate.** It is a value object,
  `ActivitySpecialty` = `'electrical' | 'mechanical'`, stored in the nullable column
  `maintenance_activity.specialty` because activities created before this change have none.
  `register()` requires a specialty. A missing or unknown value is a 400 `validation-error` from
  the DTO's `@IsIn`. That covers both "no specialty" and "both specialties", because one enum
  field cannot hold two values.
- **Editing.** `PATCH /maintenance-activities/:id` now takes `{ name, specialty }` and edits
  both. `RecordDependencies` (issue #94) still guards it: any change to an activity used by a PM
  plan item, active or deactivated, is a 409 `record-has-dependents`. The specialty therefore
  locks at exactly the moment the name does.
- **Legacy assignment is the one exception to that lock.**
  - `GET /maintenance-activities/unassigned-specialties` lists the activities that have no
    specialty.
  - `POST /maintenance-activities/specialty-assignment`
    `{ assignments: [{ activityId, specialty }] }` assigns all of them at once.
  - Only System Admin may call either route; every other role, Technical Manager included, gets a
    403.
  - The request must name **every** unassigned activity. Otherwise nothing is written and the
    response is a 400 `specialty-assignment-incomplete`. An entry naming an activity that already
    has a specialty gets the same 400, because that activity is not part of the set being
    completed.
  - The route bypasses `RecordDependencies` on purpose and records one
    `MaintenanceActivitySpecialtyAssigned` event per activity, each audited.
  - No "done" flag is stored. Once the unassigned list is empty, the frontend never shows the
    modal again.
- **History shows the activity's current specialty**, read from the catalog rather than from a
  snapshot. Once an activity is in a plan, its specialty can never change again, so the current
  value is also the value at the time. The legacy assignment therefore adds the specialty to
  existing executions without rewriting any execution row.
- **Activities without a specialty** exist only until the admin assigns them. Until then they
  appear only under the filter «همه», and grouped views put them in a third group,
  «تخصص تعیین نشده».
- **Specialty filter.** `GET /pm-schedule/overview` and `GET /pm-schedule/calendar` take an
  optional `specialty` query parameter (`electrical | mechanical`), ANDed with the other filters.
  The backend applies it the way it applies `activityId`: it narrows the plan items by their
  activity's specialty before loading executions.
- **Operating hours.**
  - `POST …/executions` takes an optional `operatingHours`: a number ≥ 0 and ≤ 1,000,000, with at
    most 2 decimals.
  - A negative or non-numeric value is a 400 `validation-error`.
  - Stored in `maintenance_execution.operating_hours numeric(9,2)`, nullable.
  - Never compared with earlier values.
  - History rows expose it as `operatingHours: number | null`. The UI shows `null` as «ثبت نشده»,
    never as `0`.
- **Test door for legacy activities.** A testing controller owned by the maintenance module,
  `POST /api/testing/maintenance/legacy-activities` `{ name }` → 201 `{ id }`, mounted only when
  `NODE_ENV=test` (the same gate as `TestingModule`). On a fresh database it is the only way to
  reproduce an activity "registered before specialties existed".

## Risks

- The legacy bypass must stay out of the general edit path. It only ever writes a specialty onto
  an activity whose specialty is null.
- Existing acceptance automation that registers activities must start sending a specialty.
- Grouping the daily list must keep the order inside each group: equipment name, then plan order,
  then due date.
