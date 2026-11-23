# Multi-activity QC recording — plan (issue #132)

Design: `docs/superpowers/specs/2026-11-23-multi-activity-qc-recording-design.md`.

## Contract (pinned field names)

`POST /api/qc-equipment/:equipmentId/executions` — roles `QC_RECORDER_ROLES`

Request:
```json
{
  "submissionId": "uuid (client-generated, reused on resend)",
  "trackingNumber": "TR-100",
  "activities": [ { "activityId": "uuid", "notes": "قطر در حد مجاز" }, { "activityId": "uuid" } ]
}
```
200 response:
```json
{
  "results": [
    { "activityId": "uuid", "activityName": "بازرسی ابعادی", "outcome": "recorded", "executionId": "uuid", "problemType": null },
    { "activityId": "uuid", "activityName": "بازرسی ظاهری", "outcome": "refused", "executionId": null, "problemType": "qc-activity-not-assigned" }
  ]
}
```
Errors: 400 `validation-error` (fields `trackingNumber`, `activities`, `submissionId`),
403, 404 `equipment-not-found`, 409 `equipment-retired`.

## QA (acceptance-tests/)
1. Step definitions for the eight scenarios' new sentences (reuse existing «هیچ انجامی …»,
   «سوابق انجام QC تجهیز …», «N سابقه انجام …», «سابقه انجام … با شماره ردیابی …»,
   «پیغام خطای شماره ردیابی …», «اکنون …», «تخصیص … برداشته شده باشد», «… تخصیص داده شده باشد»).
2. Tasks in `screenplay/quality-control/`: record several activities (browser checklist and API
   variants), resend the last submission noted on the actor's notepad, the two resend
   preconditions (lost response: send and ignore the answer; partial: unassign ظاهری, send,
   reassign).
3. «به او گفته شود که دست کم یک فعالیت …» → 400 `validation-error` on `activities`;
   «… ثبت شد و … ثبت نشد چون … تخصیص داده نشده است» → the 200 results.
4. Browser locators (`ui/qc-inspection-page.ts`) as ASSUMPTIONs: checkbox named by the activity,
   «توضیحات <activity>» textbox, «ثبت انجام» button, «شماره ردیابی» field, dialog «ثبت».

## Backend (backend/, maintenance module)
1. Domain: `QcExecution` gains optional `submissionId`; repository port gains a lookup by
   `(submissionId, activityId)`.
2. Application: `RecordQcExecutionsCommand` + handler (equipment-level checks first, then per
   activity: existing-by-submission → recorded; else `equipment.recordQcExecutionOf` saved in its
   own transaction; not-assigned / not-found → refused), one `clock.now()`.
3. Infrastructure: Prisma migration (nullable submission id, unique `(submission_id,
   activity_id)`), DTOs + Swagger schemas, controller route, regenerate OpenAPI.

## Frontend (frontend/, features/qc-inspection)
1. Gateway method for the new endpoint (generated client).
2. Checklist rows with checkbox + per-row notes, «ثبت انجام» → tracking-number dialog,
   per-activity result, resend with the same `submissionId`, refresh on success.
3. Specs; confirm the a11y audit covers the route.
