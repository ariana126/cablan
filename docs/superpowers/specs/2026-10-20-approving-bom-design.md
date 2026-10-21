# Approving daily BOMs — design

**Date:** 2026-10-20 · **Mode:** auto (decisions taken by the orchestrator from the Gherkin and the user's notes)

## Capability

Management (مصطفی) and System Admin (یاشار) review daily BOMs ("آنالیز روزانه") on the dashboard,
correct them if needed, and **approve** them — so everyone can see which daily BOMs were checked and
by whom. Editing an approved BOM sends it back to unapproved; approval can also be revoked directly.

User notes: *"This changing of behavior affected other existing specs as well which you can find in
git staged; those scenarios also have to be implemented. Current daily BOMs in the system are
unapproved by default so consider this in the migration."*

## Scope — scenarios

**`bom-analyzing/approving-bom.feature`** (new, all API-voiced — no «از داشبورد» in its steps):
تایید آنالیز روزانه توسط مدیریت · ثبت آنالیز روزانه جدید · تایید آنالیز روزانه توسط کاربر مجاز ·
تلاش کاربر بدون دسترسی برای تایید آنالیز روزانه · لغو تایید آنالیز روزانه توسط کاربر مجاز ·
تلاش کاربر بدون دسترسی برای لغو تایید آنالیز روزانه · ویرایش آنالیز روزانه تایید شده ·
ویرایش ناموفق آنالیز روزانه تایید شده، وضعیت آن را تغییر نمی دهد · تایید مجدد آنالیز روزانه پس از ویرایش.

**Modified existing specs** (uncommitted diff):

- `bom-analyzing/bom-dashboard.feature` — **UI-voiced**. Product daily-BOM list is keyed by
  order number (tracking number dropped from the table and its setup data); standard-weight and
  difference columns removed; new approval status + approver columns; Excel-style column filter on
  approval status and approver; inline material-weight edit from the dashboard (score recomputes);
  approve / revoke from the dashboard (Management + Admin).
- `bom-reporting/reporting-bom.feature` — **UI-voiced**. New column order
  `شماره سفارش, شماره ردیابی, تاریخ و زمان ثبت, کنترلگر, کد MI, برند, نام محصول, وضعیت تایید, تایید کننده`;
  approval status/approver shown and filterable.
- `bom-reporting/exporting-bom.feature` — approval columns in both formats; perBom format switched
  to generic slot columns `جز n / مواد اولیه n / وزن n` padded with `-`; export honours the
  approval-status filter.
- `bom-reporting/exporting-standard-bom.feature` — same perBom slot-column change for the standard
  BOM (manufacturing-instructions) export.
- `audit-logging/viewing-audit-log.feature` — approve and revoke are audit events whose change
  lines are `وضعیت تایید` and `تایید کننده`; an edit that resets approval carries those two lines in
  the same edit event.

## Decisions

1. **Behaviour on the existing `Bom` aggregate**, not a new module or aggregate. Approval is
   state of the daily BOM and its invariant ("an edit invalidates approval") is enforced by the same
   aggregate that performs edits, inside one transaction (ADR 0007 holds automatically).
   - `Bom.approve(approverName)` — sets `approvalStatus = approved`, `approvedBy = approverName`,
     records `BomApproved`. Approving an already-approved BOM is a **no-op** (no event, approver
     unchanged).
   - `Bom.revokeApproval()` — back to `unapproved`, `approvedBy = null`, records
     `BomApprovalRevoked`. No-op if already unapproved.
   - `Bom.edit()` / `updateComponents()` — if the edit **actually changed something** and the BOM
     was approved, reset to unapproved and append the two approval change lines to the same
     `BomEdited.changes`. A failed edit (validation 400) never reaches the aggregate → status
     unchanged. A no-change edit does not reset.
   - Approver is a **cloned display name** resolved by the controller through `DisplayNameProvider`,
     exactly like `registeredBy`.
2. **Persistence:** `bom.approval_status` (text/enum, `NOT NULL DEFAULT 'unapproved'`) and
   `bom.approved_by` (nullable text). The migration's default makes every existing daily BOM
   unapproved — the user's note.
3. **HTTP:** `POST /api/boms/:id/approval` (approve) and `DELETE /api/boms/:id/approval` (revoke),
   both `204`, `@Roles(Management, SystemAdmin)` → `403` (existing forbidden problem type) for QC
   Inspector and Reporter, `404` for an unknown id. Synchronous, like every other write.
4. **Audit:** `AuditAction` gains `Approved` and `ApprovalRevoked`. Change lines use field keys
   `approvalStatus` (`unapproved`/`approved`) and `approvedBy` (`null` ↔ name). Persian labels and
   value translation happen wherever existing field keys are translated today.
5. **Read models** — every daily-BOM read that shows a row gains `approvalStatus:
   'approved' | 'unapproved'` and `approvedBy: string | null`: report rows, `GET /boms/:id`, export
   items, dashboard daily-BOM items. Report/export filters gain `approvalStatuses?` and `approvers?`
   (absent = unfiltered, `[]` = nothing, matching the module's existing convention); filter options
   gain `approvalStatuses` and `approvers` (distinct non-null).
6. **Dashboard** keeps computing score server-side; its per-product response must carry what an
   inline weight edit needs (`bomId`, `standardBomMiCode`, per line `componentId`/`materialId`).
   The Excel-style approval filters are **client-side** over the already-loaded per-product list.
   The weight edit reuses existing `PATCH /api/boms/:id`.
7. **Export perBom layout** is built in the framework's `buildComponentMaterialColumns`, shared by
   both exports — change it once to slot columns `جز n`, `مواد اولیه n`, `وزن n`, n = 1..max
   material lines across exported rows, missing cells `-`.

## Risks

- The perBom column helper is shared; changing it changes both exports at once (wanted here — both
  specs changed identically).
- Dashboard inline edit sends a full composition `PATCH`; the frontend must rebuild it from the
  row's lines. If the dashboard response lacks ids today, backend adds them.
- Approval on the audit-log scenario relies on a BOM seeded with a fixed id — QA's test-data
  concern.
