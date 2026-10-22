# Daily BOM approval audit log — design

**Date:** 2026-10-22 · **Mode:** auto · **Issue:** #58 · Gherkin approved in the issue
(`<!-- cablan:gherkin-proposal -->`, approved by the stakeholder).

## Capability

Every change to a daily BOM's approval status shows up in the system audit log as its own
Approved / ApprovalRevoked event, and each such event names the daily BOM it concerns by its
tracking number — whether the change was a user approving/revoking, or the side effect of an edit.

## Scenarios — `audit-logging/viewing-audit-log.feature`

Changed (both UI-voiced — the admin "views the details" in the audit-log page):
- ثبت رویداد تایید آنالیز روزانه — now also asserts the tracking number `TRK-3005`.
- ثبت رویداد لغو تایید آنالیز روزانه — same.

Removed: برگشت وضعیت تایید در اثر ویرایش، در همان رویداد ویرایش ثبت می شود.

New, under the rule «لغو تایید در اثر ویرایش، به صورت یک رویداد لغو تایید جداگانه پس از رویداد ویرایش ثبت می شود» (UI-voiced):
- ویرایش آنالیز روزانه تایید شده، پس از رویداد ویرایش یک رویداد لغو تایید ثبت می کند
- ویرایش آنالیز روزانه تایید نشده، رویداد لغو تایید ثبت نمی کند

## Decisions

1. **The edit no longer carries the approval lines.** `Bom.edit()` records `BomEdited` with only the
   field/composition changes, then — if the BOM was approved — a separate `BomApprovalRevoked`
   (same `approvalStatus`/`approvedBy` lines as a direct revoke). Two events, raised in that order,
   in the one command transaction. The actor of both is the editor (assumption الف).
2. **The tracking number travels on the event.** `BomApproved` and `BomApprovalRevoked` gain
   `trackingNumber` (the BOM's tracking number *after* the command — so an edit that also changes it
   names the new one, assumption ب).
3. **Where the tracking number lives in the log: an entry "subject", not a change line.** The detail
   scenarios assert the change table by set equality, and a tracking number that did not change is
   not a change. So an audit entry gains an optional **subject** — `{ field, value }`, the reference a
   reader identifies the record by (`trackingNumber` / `TRK-3005`). Stored as two nullable columns on
   `audit_log_entry` (`subject_field`, `subject_value`); only Bom Approved/ApprovalRevoked set it today.
   Generic on purpose: the audit log stays record-type-agnostic.
4. **HTTP:** `GET /api/audit-log/:id/changes` response gains `subject: { field: string; value: string } | null`
   beside `changes`. No new endpoint, no new problem type.
5. **Deterministic order of same-instant entries.** The edit and the revoke are projected
   within the same millisecond-ish window; the list sorts by `occurredAt desc`. The list must show
   the revoke as newer than the edit deterministically — the backend adds a monotonic tie-breaker
   (e.g. an autoincrement `sequence` column used as the secondary sort key, `desc`).
6. **UI:** the changes dialog shows the subject above the change table as a description list —
   `<dl>` with `<dt>` = the field's Persian label (`fieldLabel('trackingNumber')` = «شماره ردیابی»)
   and `<dd>` = the value. Absent when `subject` is null.
7. Old rows are not backfilled: earlier Approved/ApprovalRevoked entries have no subject, and
   earlier edit entries keep their approval lines.

## Risks

- Anything else reading approval lines out of `BomEdited.changes` (none expected; backend checks).
- The tie-breaker migration on a populated table — an autoincrement column backfills itself.
