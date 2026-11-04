# System Admin exceptions to the dependency-based edit/delete policy — design

Issue #110, on top of issue #94's rule (`2026-11-02-dependency-based-edit-delete-policy-design.md`).
**Capability:** the System Admin — and only the System Admin — may (a) correct the name (and a
material's code) of a record in use, with the correction carried into every related record and
snapshot, (b) delete PM execution records, (c) delete an inactive PM plan row with its executions,
(d) delete retired equipment with everything operational under it, and (e) reactivate retired
equipment, continuing or restarting each activity's calendar. Every other user, Technical Manager
included, stays under issue #94's rule. The general rule still holds for every other case and for
future features; an exception exists only where the product owner approved one.

## Scenarios

Appended, as approved in the issue's `cablan:gherkin-proposal` comment, to nine feature files; the
issue #94 scenario «مدیر سیستم هم نام تجهیزی را که برنامه PM دارد نمی تواند تغییر دهد» is removed.

| Feature file | Rules added |
|---|---|
| `bom-registration/registring-material.feature` | correction of name+code with confirmation; no confirmation → nothing changes; duplicate code refused |
| `bom-registration/registring-product.feature` | product rename carried into standard and daily BOMs |
| `bom-registration/registring-component.feature` | component rename carried into the product |
| `maintenance-management/registring-equipment.feature` | equipment rename (active or retired) carried into history; a deleted equipment's name is free again |
| `maintenance-management/registring-maintenance-activity.feature` | activity rename carried into the plan and history |
| `maintenance-management/recording-maintenance-execution.feature` | delete one execution / all of a row; other rows and equipment untouched; non-admins refused; status after deletion (overdue until the next due date, then missed); re-recording; an inactive row stays unrecordable |
| `maintenance-management/planning-preventive-maintenance.feature` | delete an inactive row with its executions; active row refused; delete retired equipment; active equipment refused; reactivation (continue / new first due date ≥ today / per-activity choice / separately deactivated rows stay inactive); Technical Manager refused (403) on all three |
| `maintenance-management/technical-management-dashboard.feature` | every retirement gap excluded from adherence/completion; deleted data leaves past statistics; coverage counts reactivated equipment |
| `audit-logging/viewing-audit-log.feature` | a correction leaves earlier entries alone and is its own entry; deletions and reactivation are logged |

Door split (browser vs HTTP) is QA's call by grammatical voice. Since the System Admin's
confirmation («… را تایید می کند» / «… تایید نمی کند») and the delete/reactivate dialogs are
things a person sees, the UI must offer them all.

## Decisions

### 1. Correction with dependents — one flag on the existing edit routes

The edit routes keep their bodies and gain one optional boolean, **`applyToRelatedRecords`**:

| Record | Route | Correctable fields |
|---|---|---|
| Material | `PATCH /materials/:id` | `name`, `code` |
| Product | `PATCH /products/:id` | `name` |
| Component | `PATCH /components/:id` | `name` |
| Equipment | `PATCH /equipment/:id` | `name` (retired equipment too) |
| Activity | `PATCH /maintenance-activities/:id` | `name` |

- Without the flag, or by anyone but `SystemAdmin`, nothing changes from issue #94: a record with
  dependents is a 409 `record-has-dependents`. That 409 **is** the confirmation prompt: the
  frontend, for a System Admin whose edit changed only correctable fields, shows a confirmation
  dialog with the `dependents` list and re-sends with `applyToRelatedRecords: true`. Cancelling or
  closing the dialog sends nothing — nothing changes ("بدون تایید هیچ چیز اصلاح نمی شود").
- With the flag, as System Admin: if the edit changes anything **outside** the correctable fields
  (a product's composition, an activity's specialty, …) it is still the 409 — the exception covers
  the table only. Otherwise the record is changed and the correction is **propagated** in the same
  transaction.
- The flag on a record with no dependents is harmless (an ordinary edit).
- Uniqueness rules run unchanged before anything is written (e.g. `material-code-taken`), so a
  clash changes nothing anywhere.
- Retired equipment: the correction skips `equipment-retired` and leaves it retired.

**Propagation, across modules, without reversing the arrows.** Like `DependentsProbe`, `framework/`
owns a second port, **`CorrectionPropagator`** — `propagate(reference: RecordReference,
correction: { name?: string; code?: string }): Promise<void>` — implemented by every module that
holds snapshots of the record type, registered the same way as the probes, and called through
`RecordDependencies` (e.g. `propagateCorrection(reference, correction)`) by the edit handler, inside
its `UnitOfWork`. Each propagator rewrites only the **snapshot columns** that carry the corrected
name/code, by direct update on `txHost.tx`:

- `products`: product composition snapshots (if any) of materials/components.
- `manufacturing-instructions`: `productName`, composition component/material names and codes.
- `boms`: product name, composition component/material names and codes of daily BOMs (and any
  stored review/edit-history text that names them is **not** rewritten — it is history).
- `maintenance`: `pm_plan_item.activity_name`, `maintenance_execution` equipment/activity names.

Propagation **never** goes through an aggregate's edit method and emits no domain events: weights,
due dates, performers, performed-at and approval status stay as they were, and a reviewed daily BOM
is not returned to pending. The only audit entry is the corrected record's own ordinary edit event
(`MaterialEdited`, `ProductRenamed`, `ComponentRenamed`, `EquipmentRenamed`,
`MaintenanceActivityEdited` → `Edited`, with old/new per changed field, actor, time). Earlier audit
entries are snapshots and are never rewritten.

### 2. Deleting PM executions — System Admin only

- `DELETE /equipment/:id/pm-plan-items/:itemId/executions/:executionId` → 204 (one).
- `DELETE /equipment/:id/pm-plan-items/:itemId/executions` → 204 (all of that row; 204 when none).
- Allowed on active or inactive rows and on retired equipment. Unknown ids → 404.
- Each deleted execution emits `MaintenanceExecutionDeleted` → audit `MaintenanceExecution` /
  `Deleted` (`equipment`, `activity`, `dueDate`, `performedBy` → `''`) — the UI label «حذف سابقه انجام».
- Nothing else changes: statuses are computed, so the occurrence simply has no execution again.
  Today before its next due date it is `overdue` and the next due date is it again (re-recordable);
  from its next due date on it is `missed` and not recordable. An inactive row or retired equipment
  stays unrecordable (existing 409s).
- `GET /equipment/:id/maintenance-history` rows gain **`id`** (execution id) and **`planItemId`**
  so the UI can address them.

### 3. Deleting an inactive PM plan row — System Admin only

`DELETE /equipment/:id/pm-plan-items/:itemId` → 204. The row must be deactivated, else 409
**`pm-plan-item-active`** («برای حذف ردیف فعال، ابتدا آن را غیرفعال کنید.»). Removes the row from
the `Equipment` aggregate and deletes that row's executions, in one transaction. Allowed on retired
equipment. Event `PmPlanItemDeleted` → audit `PmPlanItem` / `Deleted` (`equipment`, `activity` →
`''`) — label «حذف ردیف غیرفعال برنامه». Other rows (of the same activity too), other equipment and
the activity itself are untouched.

### 4. Deleting retired equipment — System Admin only

`DELETE /equipment/:id` → 204. Must be retired, else 409 **`equipment-not-retired`**
(«فقط تجهیز کنار گذاشته شده قابل حذف است.»). Deletes the equipment, all its plan rows (cascade) and
all their executions in one transaction. This is a deliberate exception to issue #94's "no cascade"
for this case only. The name becomes free. Event `EquipmentDeleted` → audit `Equipment` / `Deleted`
(`name` → `''`) — label «حذف تجهیز». Deleted data disappears from every read — detail, history, daily
list, range reads, filter options, dashboard (past periods included).

### 5. Reactivating retired equipment — System Admin only

`POST /equipment/:id/reactivation` → 204, body
`{ rescheduledItems?: { planItemId: string; firstDueDate: string /* ISO date */ }[] }`.

- Must be retired, else 409 **`equipment-not-retired`**.
- Each active row listed gets a **new first due date** keeping its interval; rows not listed
  **continue their previous calendar**. A listed id that is not an active row of this equipment →
  400 **`invalid-reactivation-item`**. A `firstDueDate` before today (Tehran) → 400
  **`reactivation-first-due-date-in-past`** («اولین موعد تازه نمی تواند پیش از روز فعال سازی
  باشد.»), and nothing changes (equipment stays retired). Today itself is allowed.
- Deactivated rows stay deactivated.
- Event `EquipmentReactivated` → audit `Equipment` / new action **`Reactivated`** (`name` `''` →
  name; plus one line per rescheduled item) — label «فعال سازی دوباره تجهیز».

**Domain model: retirement periods.** `Equipment` keeps a list of **service breaks**
`{ retiredAt, reactivatedAt | null }` instead of one `retiredAt` (retired = last break open). The
column `retired_at` is migrated into the new storage (JSON column or a table — backend's call). For
the calculator, each break is the gap **from the day after the Tehran date of `retiredAt` up to,
but not including, the Tehran date of `reactivatedAt`**: due dates in a gap are **not generated** —
not listed, not counted, not recordable (one that already has an execution is kept). The
retirement day itself stays in service, as before (the approved overview rule «کنار گذاشتن تجهیز
مثل حذف همه فعالیت های آن در همان روز است»). *(The first draft of this design excluded the
retirement day too, on a miscount of the Jalali dates; CI's acceptance run caught it.)* Due dates before a gap keep their judgement: an undone one turns `missed` once the
schedule's next due date passes, gap or not (07/08 in the example is `missed`). After reactivation
the current occurrence can never be one before the gap, so a missed pre-retirement occurrence is not
recordable. A rescheduled row gets a **restart segment** in its `PmSchedule` starting at the new
first due date with the same interval — a new segment kind exempt from "starts on a due date of the
previous segment", allowed only at reactivation and only on or after the reactivation day.

Coverage (`PmCoverage`) stays a current-state metric; a reactivated equipment counts again as in
service.

Worked examples (Jalali, months 7–11 have 30 days): every 7 days from 07/01 → 07/01, 07/08, 07/15,
07/22, 07/29, 08/06, 08/13, 08/20. Retired 07/10, reactivated 07/20: 07/15 out, next due 07/22,
07/08 missed. Retired again 08/05, reactivated 08/18: 08/06, 08/13 out. Done 07/01, 07/22, 07/29,
08/20 → 4 of 5 → 80%. Rescheduled to 07/25 → 07/25, 08/02.

### 6. Roles

All five new capabilities are `@Roles(Role.SystemAdmin)` → 403 for everyone else (Technical
Manager, PM inspector, production roles). The correction flag is silently ineffective for a
non-admin (they get the ordinary 409).

## UI scope

- **Correction confirmation** on the five edit dialogs: for a System Admin, a 409
  `record-has-dependents` on an edit that changed only correctable fields opens a confirmation
  dialog («اعمال در اطلاعات و سوابق مرتبط») naming the dependents
  (`recordHasDependentsMessage()` wording) and saying the change applies to all related records and
  history; «تایید» re-sends with `applyToRelatedRecords: true`, «انصراف»/close changes nothing. Other
  roles keep today's in-dialog refusal.
- **Equipment maintenance history**: per-row «حذف سابقه» (admin only), with a confirm dialog naming
  the activity, due date and performer.
- **Equipment detail** (PM plan): per active and inactive row «حذف همه سوابق» (admin only, confirm
  names the row and the count); per inactive row «حذف ردیف» (admin only, confirm says the row and
  all its executions are deleted).
- **Equipment list/detail**, retired equipment, admin only: «حذف تجهیز» (confirm lists plan rows
  and executions that go) and «فعال سازی دوباره», a dialog listing each active row with a per-row
  choice «ادامه برنامه قبلی» / «تعیین اولین موعد تازه» + Jalali date (min = today).
- Problem details above shown in the open dialog.

## Risks

- **Retirement-day rule**: the retirement day stays in service (§5); existing scenarios that
  expect a due date on it keep passing.
- **Propagation completeness**: every snapshot column of the five types must be found; the backend
  lists them per module and an integration test covers material → product/standard/daily BOM and
  equipment/activity → plan/executions.
- **Check-then-act** between the dependents check and the write, as in #94: accepted.
