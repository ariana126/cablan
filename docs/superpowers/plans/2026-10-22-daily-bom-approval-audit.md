# Daily BOM approval audit log — plan

Design: `docs/superpowers/specs/2026-10-22-daily-bom-approval-audit-design.md`. Issue #58.

## QA (`acceptance-tests/`)
1. Re-automate ثبت رویداد تایید / لغو تایید آنالیز روزانه: the Given now seeds the BOM with tracking
   number `TRK-3005`; new step «و شماره ردیابی آنالیز مربوط به آن رویداد "…" باشد» reads the
   subject in the open details dialog (`<dl>`: `<dt>شماره ردیابی</dt><dd>TRK-3005</dd>`).
2. Automate the two new scenarios: list filtered by record id → newest rows (user, event-type label
   `لغو تایید` / `ویرایش`); details of the edit event and of the revoke event; subject of the revoke
   event; "no revoke event recorded" for the unapproved case.
3. Delete step definitions/tasks only the removed scenario used.

## Backend (`backend/`)
1. Domain: `BomApproved(bomId, approvedBy, trackingNumber, changes)`,
   `BomApprovalRevoked(bomId, trackingNumber, changes)`. `Bom.edit()` records `BomEdited` (no
   approval lines) then `BomApprovalRevoked` when it voided an approval.
2. audit-logging: `AuditLogProjector.project(recordType, recordId, action, changes, subject?)` with
   `subject: { field: string; value: string } | null`; Bom approve/revoke handlers pass
   `{ field: 'trackingNumber', value: event.trackingNumber }`.
3. Persistence: migration adding nullable `subject_field`, `subject_value` and a monotonic
   tie-breaker (`sequence` autoincrement) to `audit_log_entry`; list orders by
   `occurredAt desc, sequence desc`.
4. Read model / HTTP: `AuditLogChanges { changes: AuditLogChangeItem[]; subject: AuditLogSubject | null }`,
   `AuditLogSubject { field: string; value: string }`; regenerate OpenAPI.
5. Unit + integration tests; update module CLAUDE.md tables.

## Frontend (`frontend/`)
1. After `make sync-api-contract`: gateway maps `subject`.
2. Changes dialog renders `<dl>` with `<dt>{fieldLabel(subject.field)}</dt><dd>{subject.value}</dd>`
   above the table when present; spec covers present/absent.
