# Daily BOM review (approve / reject / management note) — design

**Date:** 2026-10-25 · **Mode:** auto · **Issue:** #61 · Gherkin approved in the issue
(latest `<!-- cablan:gherkin-proposal -->`, approved by the stakeholder).

## Capability

Management (مصطفی) and the system admin (یاشار) review every daily BOM that is **در انتظار تایید**
and either **approve** it (تایید) or **reject** it (عدم تایید) with a mandatory written reason. If
the reviewer edited the BOM while reviewing it, approving records those edits automatically as the
**management note** (توضیحات مدیریت). An approved or rejected BOM cannot change status directly;
only an edit sends it back to pending. "Revoke approval" is gone.

## Scenarios

- `bom-analyzing/approving-bom.feature` — rewritten (API throughout): pending on registration,
  who may approve/reject, mandatory reason (empty / whitespace), approve without note, auto
  note on edit+approve (one value, several values, inspector edits excluded, only the last review),
  no direct status change from approved/rejected, edit returns approved/rejected to pending, re-approve.
- `bom-analyzing/bom-dashboard.feature` — status renamed (تایید / در انتظار تایید / عدم تایید),
  «تایید/رد کننده» filter (shows a reviewer's approvals **and** rejections), **UI-voiced** reject
  from the dashboard; revoke from dashboard removed. The default filter (issue #63) is now
  «در انتظار تایید».
- `bom-reporting/reporting-bom.feature` — new labels, rejected row, «عدم تایید» filter, reviewer filter (UI).
- `bom-reporting/exporting-bom.feature` — both Excel formats gain «توضیحات مدیریت» after
  «تایید/رد کننده»; rejected and auto-note rows (UI).
- `audit-logging/viewing-audit-log.feature` — Approved / Rejected / ReturnedToPending events with
  status, reviewer and management-note lines; edit+approve is two events; an edit's weight change
  reads as «وزن جز مغزی مواد اولیه مسی | 3 | 2».

Note on one merge: the approved proposal predates issue #63's default «pending» dashboard filter,
so «مشاهده وضعیت تایید آنالیز های روزانه یک محصول» keeps #63's explicit filter selection
(«تایید, در انتظار تایید») with the approved table. The approved reviewer-only filter examples
(«مصطفی» → his approvals and rejections) would be empty under that default, since a pending BOM has
no reviewer; so on the dashboard, choosing named reviewers while the status filter is still at its
untouched default drops the status filter (decided during implementation).

exporting-bom's «آنالیز روزانه عدم تایید در خروجی اکسل» rejects ORD-2002 rather than the proposal's
ORD-2003, which that feature's Background never registers.

## Decisions

1. **One value object, three states.** `BomApproval` becomes a review: `status` ∈
   `pending | approved | rejected`, `reviewedBy` (display name, null iff pending),
   `managementNote` (null when pending; required non-blank on rejected; optional on approved).
   Stored values migrate `unapproved → pending`, column `approved_by → reviewed_by`, new
   nullable `management_note`.
2. **Transitions.** `approve` and `reject` only from pending; from approved/rejected they throw a
   domain error → HTTP 409 `bom-already-reviewed`. Reject with a blank/whitespace reason → 400
   `rejection-reason-required`. Any effective edit of an approved/rejected BOM sends it back to
   pending (event `BomReturnedToPending`, after `BomEdited`). No revoke.
3. **Auto note = the reviewer's own edits in the current review.** The aggregate keeps the
   *pending review changes*: every effective edit made by a user who may review (management/admin)
   is merged in (per field: first previous value, latest new value; a field back to its start
   drops out); an edit by anyone else clears them; approve/reject consumes and clears them.
   Approve renders them as the note, one Persian line each, composition order for weights:
   `وزن جز {component} مواد اولیه {material} از {old} به {new} تغییر کرد`,
   `{label} از {old} به {new} تغییر کرد` for order number / tracking number / description.
   Lines joined with `\n`. Persisted (JSON column) because edit and approve are separate requests.
4. **Audit.** Actions `Approved`, `Rejected`, `ReturnedToPending` on the `Bom` record, each with the
   tracking-number subject. Lines: `approvalStatus`, `reviewedBy`, and `managementNote` only when it
   changed. A BOM edit's composition change that only moves weights of existing component/material
   pairs is projected as one line per pair with field `materialWeight:<component>:<material>`.
5. **HTTP.** `POST boms/:id/approval` (204), `POST boms/:id/rejection` `{ reason }` (204),
   `DELETE boms/:id/approval` removed. Read models rename `approvedBy → reviewedBy`, add
   `managementNote`; filters rename `approvers → reviewers`; status wire values
   `pending|approved|rejected`. Export: «وضعیت تایید», «تایید/رد کننده», «توضیحات مدیریت» after «توضیحات».
6. **UI.** Dashboard: approve + reject buttons only while pending, reject opens a dialog with a
   required «دلیل عدم تایید» textarea; status/reviewer labels; default filter pending. Report list
   header «تایید/رد کننده». Audit log: action and field labels.

## Risks

- Wide rename across three projects (`approvedBy`, `approvers`, `unapproved`) — the plan pins names.
- The audit edit projection change touches existing weight-edit scenarios' expectations.
- Old audit rows (`ApprovalRevoked`, `approvedBy`, `unapproved`) must still render.
