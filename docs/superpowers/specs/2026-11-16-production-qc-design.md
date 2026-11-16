# Production QC — design (issue #119)

## Capability

Quality-control activities («فعالیت‌های QC») are defined once, independent of equipment, assigned to
any number of pieces of equipment, and recorded as done («ثبت انجام») by inspectors who scan the
equipment's QR code in the app, each record carrying a mandatory tracking number («شماره ردیابی»).
Management reviews every record — counts, the interval since the previous execution of the same
activity on the same equipment, who recorded it, notes — per equipment («پرونده QC تجهیزات») and
plant-wide («سوابق فعالیت‌های QC»).

Approved Gherkin (issue #119's `cablan:gherkin-proposal`, approved 2026-11-16):

- **New** `acceptance-tests/specs/quality-control/registring-qc-activity.feature` — «تعریف فعالیت
  های QC»: define without equipment; who may define/edit (Management, System Admin); empty and
  duplicate name; an activity assigned or executed (even after unassignment) can be neither renamed
  nor deleted; an unused one is deleted; the System Admin's name correction of an activity in use,
  applied to its records.
- **New** `…/assigning-qc-activity.feature` — «تخصیص فعالیت های QC به تجهیزات»: one activity to
  several equipment, several activities to one; no duplicate assignment; who may assign/unassign
  (Management, System Admin); unassigning stops new records on that equipment only and keeps every
  record; reassigning keeps the old records and re-enables recording; no new assignment to retired
  equipment, whose QC folder stays readable; the System Admin's delete of retired equipment removes
  its assignments and QC records (others' assignments stay), and reactivation re-enables its
  activities.
- **New** `…/recording-qc-execution.feature` — «ثبت انجام فعالیت های QC حین تولید»: record with
  tracking number (any text, mandatory, blank/whitespace refused), optional notes; QC inspector,
  Management, System Admin may record; only an activity assigned to in-service equipment is
  recordable (unassigned / unassigned-later / retired → message, no record); no minimum gap between
  records; last execution per activity («بدون سابقه» when none), updated after a new record; a
  printed QR keeps working after a rename and a re-download.
- **New** `…/qc-execution-history.feature` — «سوابق فعالیت های QC»: interval from the previous
  execution of the same activity on the same equipment only, to the minute
  («1 روز و 3 ساعت و 20 دقیقه», «2 ساعت», «بدون سابقه قبلی»), unchanged by the range, the
  tracking-number filter, or unassign/reassign; counts per activity per equipment under every
  filter; only Management and System Admin read the records; only the System Admin deletes a record,
  after which intervals, counts and last executions follow the remaining records, and the locks stay
  while an assignment remains.
- **Changed** `maintenance-management/registring-equipment.feature` — equipment with a QC assignment
  or a QC record can't be renamed (Technical Manager gets the 409); the System Admin corrects its
  name and the QC records show the new one.

UI-voiced: QA decides each step's door per `acceptance-tests/CLAUDE.md`; the UI is built in full
regardless — the issue asks for four pages, a QR download and an in-app scanner.

Roles in the examples: نیکروش QC inspector, مصطفی Management, یاشار System Admin, رضازاده Technical
Manager, مسلمی PM inspector, سینا Reporter.

## Decisions

**QC lives in the `maintenance` module, beside `Equipment`.** Every rule ties QC to equipment: the
retired check refuses assignments and records, the equipment lock counts QC dependents, the System
Admin's delete of retired equipment removes its QC rows in the same transaction, and a rename shows
in the QC reads. Inside one module these are plain repository calls; a separate module would need
cross-module reads of equipment and a cross-module cascade the framework lacks (the same reasoning
put orders in `boms`, issue #101). The «کنترل کیفیت» menu is a frontend grouping only. The module's
"no route admits Management / QC inspector" assumptions (if any spec pins them) are widened for the
`qc-*` routes only.

- **`QcActivity` aggregate**: `id`, a unique trimmed `name` (≤ 200). `define`, `rename`
  (one event, none when unchanged), `delete`. Events `QcActivityDefined`, `QcActivityRenamed`,
  `QcActivityDeleted`, projected by `audit-logging`.
- **QC assignments are owned by `Equipment`** (like `PmPlanItem`s): `assignQcActivity(activityId,
  activityName)` refuses a retired equipment (`equipment-retired`) and an activity already assigned
  (`qc-activity-already-assigned`); `unassignQcActivity(activityId)` refuses one not assigned
  (`qc-activity-not-assigned`). An unassignment **deletes the assignment row** — no record names an
  assignment, records name equipment and activity — so a reassignment is just a new row. Events
  `QcActivityAssigned` / `QcActivityUnassigned`.
- **`QcExecution` aggregate**: `equipmentId`, `activityId`, `performedById`, a snapshot
  `performedByName`, `performedAt` (the clock's now — the `TunableClock` on the test stack),
  `trackingNumber` (trimmed, non-blank, ≤ 100, any text — no lookup in daily BOMs), `notes`
  (trimmed, empty → null, ≤ 2000). Recording goes through the equipment
  (`Equipment.recordQcExecutionOf(activityId, …)`) so "assigned to in-service equipment" is a
  single-aggregate check. Events `QcExecutionRecorded`, `QcExecutionDeleted`.
- **Names are read current, not snapshot.** The QC reads join the equipment's and activity's current
  names, so a System Admin correction shows everywhere at once and no `CorrectionPropagator` is
  needed (the performer name is a snapshot, like maintenance executions). Event payloads may carry
  names for the audit lines.
- **The interval is computed on read, never stored.** For each record, the previous record of the
  same `(equipmentId, activityId)` across **all** records (a window function / per-pair lookup, not
  restricted by the filters or the range). Response: `previousPerformedAt` and `intervalMinutes`
  (`floor((performedAt − previous) / 60 000)`), both `null` for the first. Deleting a record changes
  it naturally. The frontend formats minutes: non-zero parts of days / hours / minutes joined by
  « و » — «1 روز و 3 ساعت و 20 دقیقه», «2 ساعت», `0` → «0 دقیقه»; `null` → «بدون سابقه قبلی».
- **Counts** are per `(equipment, activity)` over the filtered records.

**Dependency policy (issue #94/#110).**
- New `ReferencedRecordType` `qc-activity`, answered with kinds `qc-assigned-equipment` (count and
  names: the equipment it is assigned to) and `qc-activity-execution` (count of records, no names).
  `PATCH` and `DELETE /qc-activities/:id` go through the guard → 409 `record-has-dependents`.
- `equipment` gains kinds `qc-assigned-activity` (names: its assigned activities) and
  `qc-equipment-execution` (count of its QC records), so the existing guarded rename refuses it.
- **Approved System Admin exceptions:** (1) correcting the name of a QC activity in use and of
  equipment in use, with `applyToRelatedRecords` (via `RecordDependencies.editRecordInUse()`,
  exactly as equipment/PM activities do; the reads already show current names); (2) deleting
  retired equipment deletes its QC assignments and QC records too, in the same transaction, each
  record's `QcExecutionDeleted` raised; (3) reactivation keeps the assignments, so its activities
  are recordable again. Management gets the 409 for (1).
- Unassigning and deleting a record are not guarded. Deleting a record is System Admin only.

**QR code.** The payload is the plain text `CABLAN-EQ:<equipment uuid>` — not a URL, so a phone's
camera shows only text; the id never changes, so a rename or a re-download never invalidates a
printed code. Generating the PDF and parsing a scanned code both live in the frontend (the format's
one owner); the backend only ever sees the equipment id, and every read behind it is role-guarded,
so holding a QR grants nothing.

**Reads.** Management and System Admin read QC equipment, activities and records; the QC inspector
reads only the inspection view (assigned activities with their last execution).

## UI

- «اطلاعات پایه» → «فعالیت‌های QC» (`/qc-activities`, Management + System Admin): table, define /
  edit / delete dialogs, refusals through `recordHasDependentsMessage()`, the System Admin's
  correction through the existing confirmation dialog.
- «کنترل کیفیت» → «پرونده QC تجهیزات» (`/qc-equipment`, Management + System Admin), modelled on
  «پرونده فنی تجهیزات»: a shelf of equipment, each opening `/qc-equipment/:equipmentId` with two
  sections — «فعالیت‌های QC تجهیز» (list, «افزودن فعالیت» picking from the catalog's unassigned
  ones, «حذف تخصیص») and «سوابق انجام فعالیت‌ها» (rows: activity, recorder, date-time, interval;
  click → details dialog with tracking number and notes; filters range / activity / recorder /
  tracking number; per-activity counts; the System Admin's «حذف سابقه» in the dialog).
- «کنترل کیفیت» → «بازرسی حین تولید» (`/qc-inspection`, QC inspector + Management + System Admin):
  «اسکن QR تجهیز» opens the camera; a recognised code opens a dialog with the equipment's name and
  its recordable activities, each with its own «ثبت انجام» (tracking number required, notes
  optional). Below, every equipment's activities with their last execution («بدون سابقه»), refreshed
  after a record. Clear messages for an unrecognised code, a retired equipment, no recordable
  activity, and a camera problem.
- «کنترل کیفیت» → «گزارشات» → «سوابق فعالیت‌های QC» (`/qc-executions`, Management + System Admin):
  all records, combinable filters (range, equipment, activity, recorder, tracking number), the
  same rows/details as the folder, counts per activity per equipment.
- «تجهیزات / دستگاه» (`/equipment`): a per-row «دانلود QR تجهیز» producing a printable PDF — the
  equipment's name as a heading above the QR.

## Risks

- Persian text in a generated PDF needs shaping and bidi; drawing the heading through the browser
  (canvas) and embedding it as an image sidesteps PDF font shaping.
- The camera cannot be exercised in CI; the scanner must be a thin adapter so the dialog behind it
  is testable without one.
- Problem types and field names below are pinned for QA and backend working in parallel.
