# Quality control UX redesign — plan (issue #113)

Design: `docs/superpowers/specs/2026-11-09-quality-control-ux-design.md`. UI surface: yes.
Backend: no change; no new request/response bodies. No `.feature` changes (no Gherkin proposal).

## Frontend (`frontend-engineer`)
1. Filter model in `ui/checkbox-filter-list` + `ui/checkbox-filter-dialog` — decision 1; adapt
   every host (`boms-page`, `bom-dashboard`, `standard-bom-report-filter-dialog`, and the audit log
   since it shares the component — it keeps working, and gains the same behaviour).
2. `/boms` page — decision 2.
3. Daily analysis form / preview / edit-details / resample — decisions 3 and 4.
4. `/standard-boms` page, form, detail — decision 5.
5. `/bom-dashboard` page and card — decision 6.
6. Specs for each; `make lint-accessibility` green; report every changed accessible name, role
   and filter behaviour.

## QA (`qa-engineer`)
1. Reconcile `screenplay/ui/*` page objects and tasks for boms, standard-boms, bom-dashboard,
   audit log and the filter dialog with the frontend's report. No step wording changes. Suite green.

## Backend
- None.
