# Factory Manager role — plan (issue #130)

Design: `docs/superpowers/specs/2026-11-22-factory-manager-role-design.md`.

Contract: no new endpoint or body. The one wire change is the `Role` enum gaining
`factory_manager` (request `role` of `POST users` / `PATCH users/:id`; `role` of `GET users`,
`GET users/me`). Refusals stay 403 as today.

## QA (acceptance-tests/)
1. Persona کامرانی, role `factory_manager` (`roles.ts`, `personas.ts`), Persian label «مدیر کارخانه».
2. Automate every new/changed scenario listed in the design; reuse existing steps where the text
   already exists, add the rest (home shortcuts incl. «اسکن QR تجهیز», order-list access, standard-BOM
   list/export denial, dashboard denial, base-data outline, factory-manager examples).
3. bom-dashboard.feature now uses سینا as the viewer.

## Backend (backend/)
1. `Role.FactoryManager`; role lists as in the design; `route-roles.spec.ts` matrix.
2. Narrow `qc_inspector` off orders list/get, standard-BOM list/export, dashboard — keeping the
   daily-BOM registration path's reads.
3. Unit tests; regenerate OpenAPI.

## Frontend (frontend/)
1. Contract synced by the orchestrator; role label; user form option.
2. `navigation.ts` + guards; `permissions.ts`; home shortcuts per Gherkin incl. the QR-scan shortcut.
3. Specs; register any new route in the a11y spec.
