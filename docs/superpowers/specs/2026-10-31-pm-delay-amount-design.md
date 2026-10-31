# PM delay amount («مقدار تاخیر») — design

Issue #80. A PM occurrence executed late now says by how many days: the whole Tehran days
between its due date and the day its execution was recorded. Every other occurrence (on time,
missed, overdue, due, upcoming) has no delay amount and shows «-».

## Scenarios

New rule in `acceptance-tests/specs/maintenance-management/recording-maintenance-execution.feature`
(«مقدار تاخیر موعدی که با تاخیر انجام شده …»):

- «مقدار تاخیر بر اساس روز ثبت انجام» (outline, 4 examples) — checks the equipment's
  maintenance history (سابقه تعمیرات) and the PM overview report (برنامه کلی تعمیرات و نگهداری).
- «موعدی که تا موعد بعدی انجام نشده تاخیری ندارد» — overview, missed occurrence → «-».
- «کار عقب افتاده ای که هنوز انجام نشده تاخیری ندارد» — overview, overdue occurrence → «-».

The Then steps are observations of what a person reads (a value in a history row's details, a
column in the report); which door QA drives them through follows the suite's voice rule.

## Slice

- **Domain**: `MaintenanceExecution.daysLate(): number | null`, equal to `dueDate.daysUntil(performedOn())`
  when `status()` is `late` and `null` otherwise. No new aggregate, event or persistence: the value
  is derived from the due date and the Tehran day of `performedAt`, both already stored. The unit is
  whole days, not hours (the stakeholder-approved assumption).
- **Read models / HTTP**: one new nullable integer field, `daysLate: number | null`, on
  - `MaintenanceExecutionReadModel` (equipment maintenance history), and
  - `PmOccurrenceReadModel` (PM schedule overview), taken from the occurrence's execution and
    `null` when the occurrence has no execution or was on time.
  No new endpoint, no new problem type. The OpenAPI spec is regenerated and synced.
- **UI**:
  - Equipment maintenance history: each row's details show «مقدار تاخیر: N روز», or
    «مقدار تاخیر: -» when `daysLate` is null.
  - PM overview report: a new «مقدار تاخیر» column showing «N روز» when `daysLate` is a number, «-»
    otherwise.

## Decisions and risks

- The value is derived, not stored, so there is nothing to migrate. History rows keep their meaning because the due date
  and the performed instant never change.
- The daily schedule's existing `daysOverdue` is a separate thing and stays unchanged.
- Risk: the history "details" markup is a recently added dialog. QA's locator has to match what the
  frontend renders, so the two are reconciled after the frontend step.
