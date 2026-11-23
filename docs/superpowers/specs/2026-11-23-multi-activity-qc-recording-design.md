# Multi-activity QC recording with a shared tracking number — design (issue #132)

## Capability

After scanning an equipment's QR, the QC inspector ticks one or more of its assigned activities
(a checklist that still shows each one's last execution), writes optional notes per activity,
presses «ثبت انجام», types the product's tracking number **once**, and gets one independent
record per ticked activity — same tracking number, same instant, same performer, own notes.
Each activity is accepted or refused on its own, the outcome of each is reported, and resending
the same submission never duplicates a record already made.

Feature: `acceptance-tests/specs/quality-control/recording-qc-execution.feature`, the four new
rules (eight scenarios). Every existing scenario and rule (access, deletion, last execution,
intervals, the single-activity record endpoint) stays unchanged.

| Scenario | Voice |
| --- | --- |
| ثبت دو فعالیت در یک نوبت با شماره ردیابی مشترک | active, **UI-voiced** |
| فعالیتی که انتخاب نشده سابقه ای نمی گیرد | active, **UI-voiced** |
| ثبت گروهی بدون شماره ردیابی | «تلاش» — API |
| ثبت بدون انتخاب هیچ فعالیتی | «تلاش» — API |
| یکی از فعالیت های انتخاب شده دیگر به تجهیز تخصیص داده نشده است | «تلاش» — API |
| فرستادن دوباره ثبتی که انجام شده بود اما نتیجه آن به بازرس نرسید | resend — API (a lost response can't be staged in a browser) |
| فرستادن دوباره ثبتی که فقط بخشی از آن انجام شده بود | resend — API |
| ثبت تازه همان فعالیت ها نیم ساعت بعد | active, **UI-voiced** (same step as the first) |

QA decides the door per its CLAUDE.md; the plain «… با هم ثبت می کند» should go through the
browser (`/qc-inspection`, the checklist) if the page can show an equipment's checklist without
a camera; API otherwise.

## Decisions

- **Same module, same aggregate.** The `maintenance` module's `Equipment.recordQcExecutionOf()`
  stays the one gate; a new command `RecordQcExecutionsCommand` loops over the ticked activities,
  asking the equipment per activity. No new aggregate.
- **One new endpoint**: `POST qc-equipment/:equipmentId/executions` (roles: `QC_RECORDER_ROLES`).
  Body `{ submissionId, trackingNumber, activities: [{ activityId, notes? }] }`.
  - 400 `validation-error`: `trackingNumber` blank/missing; `activities` empty (field
    `activities`); duplicate `activityId` in one submission (field `activities`); malformed ids;
    `submissionId` not a UUID.
  - 404 `equipment-not-found`; 409 `equipment-retired` — equipment-level, nothing recorded.
  - Otherwise **200** with `{ results: [...] }`, one entry per submitted activity in the
    submitted order: `{ activityId, activityName, outcome, executionId, problemType }`,
    `outcome` ∈ `recorded` | `refused`; `executionId` set when recorded (including a resend that
    finds the earlier record), `problemType` set when refused (`qc-activity-not-assigned`,
    `qc-activity-not-found`). `activityName` is null when the activity doesn't exist.
- **Idempotency by `submissionId`**: a client-generated UUID, one per submission, reused when
  the inspector resends it. A new nullable submission-id column on the QC execution table with
  a unique index on `(submission_id, activity_id)`. Before recording an activity the handler
  looks up `(submissionId, activityId)`; found → reported `recorded` with the existing id, no new
  record, no event. A concurrent duplicate insert hitting the unique index is treated the same.
  A **new** submission (new id) always makes new records, even with the same activities and
  tracking number — matching «ثبت تازه … نیم ساعت بعد» and the existing «ثبت دوباره همان فعالیت».
- **Independence**: each activity's record is saved in its own unit of work (its own audit
  entry, ADR 0007), so one refusal never rolls back another. All records of one submission share
  one `clock.now()` instant.
- **Synchronous**, like the single record.
- The existing single-activity endpoint stays (records it makes have no submission id).

## UI

`/qc-inspection` after a scan (and wherever it lists an equipment's activities): each activity row
gets a checkbox labelled by the activity name, the last-execution cell stays, and a per-row
notes field («توضیحات <activity>») for a ticked row. One «ثبت انجام» button per equipment
opens a dialog asking for «شماره ردیابی» (required; empty shows the error, nothing sent).
Pressing «ثبت انجام» with nothing ticked tells the inspector «دست کم یک فعالیت باید انتخاب شود»
and sends nothing. The result shows per activity «ثبت شد» / «ثبت نشد — <reason in Persian>».
On a partial or failed result (or a network error) the dialog keeps the same `submissionId`, so
«ارسال دوباره» resends it without duplicating; on full success the checklist clears and the last
executions refresh. A new submission draws a new `submissionId`.

## Risks

- QA's locators for the checklist are assumptions until the frontend lands; reconcile in step 6.
- The migration is additive (nullable column + unique index; NULLs never collide), so old
  records are untouched.
