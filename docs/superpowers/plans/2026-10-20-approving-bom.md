# Approving daily BOMs — Implementation Plan

> **For agentic workers:** executed by the `/develop-feature` orchestration — `qa-engineer`,
> `backend-engineer`, `frontend-engineer`, each TDD (`superpowers:test-driven-development`).
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Management and System Admin can approve / revoke approval of a daily BOM; editing an
approved BOM reverts it to unapproved; approval status and approver are visible, filterable and
exported everywhere a daily BOM is listed, and audited.

**Architecture:** New behaviour on the existing `Bom` aggregate (`backend/src/modules/boms`), two
new endpoints, two new columns with a migration defaulting existing rows to unapproved; read models
and exports extended; dashboard and report UI extended.

**Tech Stack:** NestJS + Prisma + Postgres (CQRS); Angular 21 + Material; Cucumber + Serenity/JS.

**Spec:** `docs/superpowers/specs/2026-10-20-approving-bom-design.md`

## Global Constraints

- Wire values: `approvalStatus` is `'approved' | 'unapproved'`; `approvedBy` is `string | null` (display name).
- Persian labels: `تایید شده` / `تایید نشده`; columns `وضعیت تایید`, `تایید کننده`; missing approver shows `-`.
- Only Management and System Admin approve/revoke; QC Inspector and Reporter get `403`.
- Existing daily BOMs are unapproved after the migration (column default `'unapproved'`).
- Feature files are read-only.

## Review Focus

1. Approving an already-approved BOM (by someone else) — no-op `204`, approver unchanged, no audit entry.
2. Revoking an unapproved BOM — no-op `204`, no audit entry.
3. A `PATCH` that changes nothing on an approved BOM — stays approved, no reset lines.
4. A `PATCH` that fails validation on an approved BOM — `400`, still approved by the same person.
5. Approve/revoke an unknown id — `404`.

---

## Wire contract (pinned — QA and backend build against this independently)

| Endpoint | Change |
|---|---|
| `POST /api/boms/:id/approval` | **new** — approve as current user. `204`. `403` non-Mgmt/Admin. `404` unknown. No body. |
| `DELETE /api/boms/:id/approval` | **new** — revoke. `204`. Same errors. |
| `GET /api/boms/:id` | response gains `approvalStatus`, `approvedBy` |
| `POST /api/boms/report` | each item gains `approvalStatus`, `approvedBy`; `filters` gains `approvalStatuses?: ('approved'\|'unapproved')[]`, `approvers?: string[]` |
| `GET /api/boms/report/filter-options` | gains `approvalStatuses: ('approved'\|'unapproved')[]`, `approvers: string[]` (distinct non-null, sorted) |
| `POST /api/boms/report/export` | `filters` gains the same two keys; sheet gains columns (below) |
| `POST /api/manufacturing-instructions/report/export` (existing standard BOM export path, unchanged) | perBom sheet layout change only |
| Dashboard per-product daily BOMs (existing endpoint) | each daily BOM item gains `approvalStatus`, `approvedBy`, and must carry `bomId`, `orderNumber`, `standardBomMiCode`; each line `componentId`, `materialId`, `componentName`, `materialName`, `actualWeight` |
| Audit log | `AuditAction` gains `Approved`, `ApprovalRevoked`. Change lines: `{ field: 'approvalStatus', from: 'unapproved', to: 'approved' }`, `{ field: 'approvedBy', from: null, to: '<name>' }` (and the reverse for revoke / edit-reset, appended to the same `Edited` entry) |

Export columns:
- **perMaterial:** `... توضیحات, وضعیت تایید, تایید کننده, نام جز, نام مواد اولیه, وزن مواد اولیه`.
- **perBom (daily):** `شماره سفارش, شماره ردیابی, تاریخ و زمان ثبت, کنترلگر, کد MI, برند, متراژ استاندارد, نام محصول, توضیحات, وضعیت تایید, تایید کننده, جز 1, مواد اولیه 1, وزن 1, …` — n in Persian digits (`جز ۱`), n = 1..max material lines across the exported rows in standard-BOM order, empty slots `-`.
- **perBom (standard):** `کد MI, نام محصول, برند, متراژ استاندارد, فعال, توضیحات, جز ۱, مواد اولیه ۱, وزن ۱, …` same slot rule.

---

## QA tasks (`acceptance-tests/`)

### Task Q1: approving-bom.feature
- [ ] Business Flow for all 9 scenarios/outlines; actors by role per existing cast (مصطفی Management, یاشار Admin, نیکروش QC, سینا Reporter).
- [ ] Technical layer: `ApproveBom` → `POST /api/boms/:id/approval`, `RevokeBomApproval` → `DELETE …`, question reading `approvalStatus`/`approvedBy` from `GET /api/boms/:id`; forbidden = `403` problem.
- [ ] "approved by مصطفی" preconditions done through the API as مصطفی.

### Task Q2: modified specs
- [ ] `bom-dashboard.feature`: setup table without tracking number (generate one); order-number keyed questions; approval columns; Excel-style filter; inline weight edit; approve/revoke from dashboard (UI-voiced «از داشبورد»).
- [ ] `reporting-bom.feature`: new column order, approval columns, approval filters.
- [ ] `exporting-bom.feature`, `exporting-standard-bom.feature`: new headers/slot columns; export filtered by approval status.
- [ ] `viewing-audit-log.feature`: three new approval-event examples.
- [ ] Remove automation that the edited specs dropped (standard weight / difference columns, «اختلاف وزن … مثبت است» example).

## Backend tasks (`backend/`)

### Task B1: domain
- [ ] `Bom` gains `approvalStatus: ApprovalStatus` (value object/enum `approved|unapproved`), `approvedBy: string | null`.
- [ ] `approve(approverName: string): void` — no-op if approved; else records `BomApproved`.
- [ ] `revokeApproval(): void` — no-op if unapproved; else records `BomApprovalRevoked`.
- [ ] `edit()` / `updateComponents()` — when something changed and approved → reset, add the two change lines to `BomEdited.changes`.
- [ ] Unit tests for Review Focus 1–3.

### Task B2: application
- [ ] `ApproveBomCommand(bomId, approverName)`, `RevokeBomApprovalCommand(bomId)` + handlers (load, call, save — same transaction/audit path as `EditBomHandler`).
- [ ] Read models / `BomReportRepository` / `BomDashboardRepository` port records carry `approvalStatus`, `approvedBy`; filters `approvalStatuses?`, `approvers?`; filter-options `approvalStatuses`, `approvers`.

### Task B3: infrastructure
- [ ] Prisma: `approvalStatus String @default("unapproved") @map("approval_status")`, `approvedBy String? @map("approved_by")`; `make migrate`-generated migration.
- [ ] Controller endpoints, `@Roles(Management, SystemAdmin)`, approver via `DisplayNameProvider`.
- [ ] Audit: `AuditAction.Approved`, `AuditAction.ApprovalRevoked` subscriptions.
- [ ] Export grid columns + framework `buildComponentMaterialColumns` slot layout (both exports).
- [ ] `make generate-swagger`.

## Frontend tasks (`frontend/`)

### Task F1: report list
- [ ] Column order per Global Constraints; approval columns; filters for both; detail view shows status/approver.
- [ ] Export sends the approval filters.

### Task F2: dashboard product daily-BOM list
- [ ] Rows keyed by order number; drop tracking number / standard weight / difference columns; show approval status + approver.
- [ ] Excel-style column filter menus (checkbox list of distinct values) on approval status and approver — client-side.
- [ ] Management/Admin only: approve / revoke buttons; inline material-weight edit (full-composition `PATCH /api/boms/:id`); refresh score after save.

### Task F3: audit log
- [ ] Labels `approvalStatus` → `وضعیت تایید`, `approvedBy` → `تایید کننده`; values `approved`/`unapproved` → `تایید شده`/`تایید نشده`, `null` → `-`; action labels for `Approved` / `ApprovalRevoked`.
