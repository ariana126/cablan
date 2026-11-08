# Technical module UX redesign — plan (issue #112)

Design: `docs/superpowers/specs/2026-11-08-technical-module-ux-design.md`. UI surface: yes
(the changed scenario is UI-voiced). Backend: no change; no new request/response bodies.

## Orchestrator
- Add the approved row «فنی | داشبورد مدیریتی فنی» to «میانبرهای مدیر فنی» in
  `acceptance-tests/specs/home/role-based-home-page.feature`.

## Frontend (`frontend-engineer`)
1. `navigation.ts`: append `pm-dashboard` to the technical manager's home shortcuts; spec.
2. Equipment page, form, retire dialog — design decision 3.
3. Maintenance activities page and form — decision 4.
4. Daily PM schedule — decision 5.
5. Equipment folder and folder board — decisions 6 and 7.
6. PM schedule calendar/table — decision 8.
7. PM dashboard — decision 9.
8. Specs for each; `make lint-accessibility` green; report every changed accessible name/role.

## QA (`qa-engineer`)
1. Confirm «میانبرهای مدیر فنی» passes with the new row.
2. Reconcile `screenplay/ui/*` page objects and tasks with the frontend's reported markup changes
   (equipment, maintenance activities, daily PM schedule, pm-plans folder, pm-overview,
   pm-dashboard). No step wording changes.

## Backend
- None.
