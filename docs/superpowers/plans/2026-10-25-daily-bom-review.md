# Daily BOM review — plan (issue #61)

Design: `docs/superpowers/specs/2026-10-25-daily-bom-review-design.md`.

## Contract (pinned — QA, backend and frontend all build on these names)

- Status wire values: `"pending" | "approved" | "rejected"` (enum `ApprovalStatus`).
- `GET boms/:id`, report rows, dashboard daily-BOM rows: `approvalStatus`, `reviewedBy: string | null`,
  `managementNote: string | null`.
- Filters (report + dashboard): `approvalStatuses: ApprovalStatus[]`, `reviewers: string[]`;
  filter-options response: `approvalStatuses`, `reviewers`.
- `POST boms/:id/approval` → 204. From approved/rejected → 409 problem type `bom-already-reviewed`.
- `POST boms/:id/rejection` body `{ "reason": string }` → 204. Blank/whitespace/missing → 400
  problem type `rejection-reason-required`. From approved/rejected → 409 `bom-already-reviewed`.
  Unauthorised role → 403 (same as approve).
- `DELETE boms/:id/approval` removed.
- Audit actions (record type `Bom`): `Approved`, `Rejected`, `ReturnedToPending`; change-line
  fields `approvalStatus`, `reviewedBy`, `managementNote`; subject `trackingNumber`.
  Weight-only composition edits: field `materialWeight:<component>:<material>`.
- Management-note line formats (Latin digits, as stored):
  `وزن جز {component} مواد اولیه {material} از {old} به {new} تغییر کرد`;
  `{شماره سفارش|شماره ردیابی|توضیحات} از {old} به {new} تغییر کرد`; lines joined by `\n`.
- Excel (both formats): columns «وضعیت تایید», «تایید/رد کننده», «توضیحات مدیریت» right after
  «توضیحات»; status labels تایید / در انتظار تایید / عدم تایید; empty → `-`.

## QA (acceptance-tests)
1. Rewrite the approval vocabulary (`daily-bom-approval.ts`): approve, reject with reason
   (API + `fromTheDashboard`), edit-then-approve, statuses, reviewer, management note; remove revoke.
2. New/renamed steps for all five feature files; the shared «… توسط {actorName} با دلیل "…" عدم تایید شده باشد»
   precondition lives in `common.steps.ts` beside the approval one.
3. Audit steps for Rejected / ReturnedToPending / edit+approve.

## Backend
1. Domain: `BomApproval` → review VO; aggregate `approve`, `reject`, `edit(..., byReviewer)`,
   pending review changes, note rendering; events `BomApproved` (+ managementNote), `BomRejected`,
   `BomReturnedToPending`; drop `BomApprovalRevoked`/`revokeApproval`.
2. Application: `ApproveBomCommand`, `RejectBomCommand`, edit handler passes whether the editor may
   review; read models; filters; export grid columns.
3. Infrastructure: migration, mapper, controllers/DTOs, problem types, audit handlers, OpenAPI.

## Frontend
1. Regenerated client; status labels (`approval-labels`), reviewer label «تایید/رد کننده».
2. Dashboard: reject dialog (required «دلیل عدم تایید»), approve/reject only while pending,
   remove revoke, default filter `pending`, filter options `reviewers`.
3. Reports list header and filter; audit-log action labels (Rejected «عدم تایید»,
   ReturnedToPending «بازگشت به در انتظار تایید»), field labels (`reviewedBy`, `managementNote`
   «توضیحات مدیریت», `materialWeight:c:m` → «وزن جز c مواد اولیه m»), legacy `approvedBy`/`unapproved`/`ApprovalRevoked`.
