# Dashboard approval filter — design (issue #57)

## Capability

The daily-BOM dashboard's «وضعیت تایید» and «تایید کننده» Excel-style filters move out of the
per-product panel and up next to the date range, so one selection filters the **whole
dashboard**: the product list shows only products with at least one matching daily BOM in the
range, and a selected product's panel shows only its matching daily BOMs.

Semantics (agreed with the stakeholder): several values in one filter = any of them; both
filters together = both must match; no match = the empty state, same as the date filter.

Scenarios (`acceptance-tests/specs/bom-analyzing/bom-dashboard.feature`, rule «لیست محصولات و
آنالیز های روزانه داشبورد را می توان در کنار بازه زمانی، مشابه فیلتر اکسل …»), all **UI-voiced**:

- الگوی سناریو: فیلتر لیست محصولات داشبورد بر اساس وضعیت تایید یا تایید کننده (4 examples)
- الگوی سناریو: فیلتر آنالیز های روزانه یک محصول با فیلتر تایید داشبورد (4 examples)
- سناریو: فیلتر همزمان بر اساس وضعیت تایید و تایید کننده فقط آنالیز های جور با هر دو را نشان می دهد
- سناریو: فیلتر تایید که هیچ آنالیز روزانه ای با آن جور نیست

Removed: the old rule «لیست آنالیز های روزانه یک محصول را می توان مشابه فیلتر اکسل …» and its
outline. The date-range rule lost the word «فقط»; its examples are unchanged.

## Slice

- **Backend.** No new module or aggregate — it is the existing dashboard read side. Both
  dashboard queries gain two optional filters with exactly the daily-BOM report's semantics
  (`BomReportFiltersDto`): `approvalStatuses?: ('approved'|'unapproved')[]` and
  `approvers?: string[]` (approver display names; `''` = no approver). Absent = unfiltered,
  `[]` = match nothing. Product rows' `dailyBomCount` and `lastRegisteredAt` count only the
  matching daily BOMs. Server-side, because the product list can no longer be derived from
  one product's already-loaded rows.
  - `POST /api/boms/dashboard` body: `{ from?, to?, approvalStatuses?, approvers? }`
  - `POST /api/boms/dashboard/{productId}/daily-boms` body: `{ from?, to?, approvalStatuses?, approvers? }`
  - Responses unchanged. Validation errors as today (400 validation-error).
- **Frontend.** The two filter buttons sit in the date-range filter bar (or right beside it,
  in its own labelled group), open the same checkbox filter dialog, and their selection is sent
  with both dashboard requests. Options come from the existing
  `GET /api/boms/report/filter-options` (`approvalStatuses`, `approvers`) plus «بدون تایید کننده»
  for approvers, so no new endpoint. The panel's own filters and the client-side
  `filterDailyBoms` go away. Empty product list under an approval filter shows the empty state.
- **QA.** Automate the new outlines/scenarios through the browser; drop the removed outline's
  step definitions and the panel-filter locator; the approval Givens reuse the existing
  common step.

## Decisions / risks

- Reusing report filter-options lists approvers from all daily BOMs, not the range — acceptable,
  same as the report.
- Stats tiles reflect the filtered set (they are computed from the product rows).
- Risk: the markup contract — QA's locators for the moved buttons must match the frontend; the
  frontend keeps the existing filter-button accessible-name convention (prefix «وضعیت تایید» /
  «تایید کننده», growing «، N مقدار انتخاب شده»).
