# Dashboard order/tracking-number filters — plan

Design: `docs/superpowers/specs/2026-10-26-dashboard-number-filters-design.md`. Issue #70.

## Contract (pinned)

Both `DashboardProductsDto` and `ProductDailyBomsDto` gain:

```json
{ "orderNumber": "ORD-50", "trackingNumber": "TRK-600" }
```

- `orderNumber?: string`, `trackingNumber?: string` — optional, trimmed; blank = unfiltered;
  otherwise case-insensitive "contains". AND with `from`/`to`/`approvalStatuses`/`reviewers`.
- Daily-BOM items keep their existing `trackingNumber` field (unchanged response).

## QA (`acceptance-tests/`)

1. Background seeding reads the optional «شماره ردیابی» column and registers each daily BOM with it.
2. Steps: product list with date range + one or two «جست و جوی "<x>" در فیلتر "<field>"» pairs;
   product selection with the same; reuse existing «فقط محصولات …», «فقط آنالیز های روزانه …»,
   «فهرست خالی» questions.
3. Question «شماره ردیابی آنالیز های روزانه به صورت زیر» — table of order number → tracking number.
4. UI locators: text inputs by label «شماره سفارش» / «شماره ردیابی»; tracking number per row.

## Backend (`backend/`)

1. Query/handler inputs for both dashboard queries gain `orderNumber?`, `trackingNumber?`.
2. Dashboard repository: `contains` + `mode: 'insensitive'` on `orderNumber` / `trackingNumber`.
3. DTOs + validation (`IsOptional`, `IsString`), unit/repository specs, regenerate OpenAPI.

## Frontend (`frontend/`)

1. `make sync-api-contract` (orchestrator).
2. Dashboard filter state gains the two strings; both requests send them (omit when blank).
3. Two `mat-form-field` text inputs labelled «شماره سفارش» / «شماره ردیابی» in the filter bar.
4. Daily-BOM view shows «شماره ردیابی» next to «شماره سفارش».
5. Specs; a11y covers the existing dashboard route.
