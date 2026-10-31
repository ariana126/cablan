# PM delay amount — plan

Design: `docs/superpowers/specs/2026-10-31-pm-delay-amount-design.md`.

## Contract (pinned)

- History entry (`MaintenanceExecutionReadModel` / its OpenAPI schema): add `daysLate: number | null`.
- Overview occurrence (`PmOccurrenceReadModel` / its OpenAPI schema): add `daysLate: number | null`.
- `daysLate` is a positive integer only when `status === 'late'`, and `null` for every other status.

## QA (acceptance-tests/)

1. Step definitions for «انتظار می رود مقدار تاخیر <activity> <equipment> برای موعد "<date>" در
   سابقه تعمیرات <equipment> "<amount>" باشد» and «… در برنامه کلی تعمیرات و نگهداری "<amount>" باشد».
2. Questions that read the delay amount from the history and from the overview. On the HTTP door they
   format `daysLate` as `N روز` / `-`; on the UI door they read the rendered text.
3. Reuse the existing Given/When steps (today, login, recording, viewing the overview).

## Backend (backend/)

1. Domain: `MaintenanceExecution.daysLate()`, with unit tests for four cases: early, same day,
   1 day late, 6 days late.
2. Application: both read models gain `daysLate`, both handlers fill it, and the handler specs cover it.
3. Infrastructure: the OpenAPI schemas gain a nullable integer `daysLate`; then run `make generate-swagger`.

## Frontend (frontend/)

1. After `make sync-api-contract`: the history details show «مقدار تاخیر: N روز» / «مقدار تاخیر: -».
2. The PM overview table gets a «مقدار تاخیر» column (N روز / -).
3. Specs for both. The a11y routes stay unchanged, since there is no new route.
