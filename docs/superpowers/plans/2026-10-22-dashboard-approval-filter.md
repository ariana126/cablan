# Dashboard approval filter — plan (issue #57)

Design: `docs/superpowers/specs/2026-10-22-dashboard-approval-filter-design.md`.

## Backend (`backend-engineer`)
1. Dashboard product-list query: add `approvalStatuses?: BomApprovalStatus[]`, `approvers?: string[]`
   (`''` = no approver; absent = unfiltered; `[]` = nothing). Count/last-registered over matches only.
2. Product daily-BOMs query: same two filters.
3. `DashboardProductsDto`, `ProductDailyBomsDto`: add the two fields with the same validation and
   Swagger docs as `BomReportFiltersDto`. Unit + integration-level tests; regenerate the spec.

## QA (`qa-engineer`)
1. Step definitions for the new steps (dashboard with range + selected values for a filter;
   product with range + selected values; range + status + approver; «فقط محصولات "…" نمایش داده شود»).
2. Remove the old panel-filter outline's steps and locators; add locators for the dashboard-level
   filter buttons. UI door throughout; approval Givens via the existing common step.

## Frontend (`frontend-engineer`)
1. Gateway: pass `approvalStatuses`/`approvers` on both dashboard calls.
2. Page: two filter buttons beside the date range, options from `boms/report/filter-options`
   (+ «بدون تایید کننده»), selection drives both resources; remove panel filters and
   client-side filtering. Specs and a11y updated.
