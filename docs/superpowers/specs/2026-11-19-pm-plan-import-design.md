# Bulk import of PM plans from Excel — design

Issue #127. The System Admin (یاشار), and only they, uploads the plant's PM matrix (sheet `pm`:
equipment down column A from row 3, each row's first due date in column B, activity names across
row 1 from column C, each activity's interval in days in row 2, `+` at a crossing meaning "this
activity is in this equipment's plan"). The system checks the whole file and shows every error at
once with its sheet, row/column, cell address, value and reason, plus how many plan items it would
add, which are already in force ("از قبل موجود") and which differ from an active item. Only an
error-free file can be confirmed, and confirming adds every new item or none. The import never
changes, deactivates or deletes an existing item, and never creates equipment or activities.

## Scenarios

`acceptance-tests/specs/maintenance-management/importing-pm-plans.feature` (new, verbatim from the
approved proposal). Every rule: first due date of a row, `+` only, untouched existing plans,
preview before confirm, all errors at once (unknown names, invalid Jalali date, empty first due
date, empty/invalid interval, invalid mark, retired equipment, duplicate equipment/activity,
corrected file), re-upload idempotent, conflicts reported not applied, System Admin only.

**UI-voiced**: «یاشار اکسل برنامه PM زیر را بارگذاری (و تایید) می کند» and «… همان اکسل را دوباره
بارگذاری و تایید می کند». So the feature gets UI; QA picks each step's door under
`acceptance-tests/CLAUDE.md`. The «تلاش …» access outline is API (403).

## Decisions

- **Lives in the `maintenance` module**, as a behaviour on the existing `Equipment` aggregate
  (`addPlanItem`) — no new aggregate and no new table. A confirmed import is N ordinary "plan item
  added" changes, so the existing audit entries, daily list, calendar, dashboard and folder show
  the items with no change. No import record and no revert (the proposal left these to a separate
  issue).
- **Parsing is a pure domain service** (`PmPlanSheet` → `PmPlanImportCheck`): given the cell grid
  and the registered equipment/activities/active items, it yields `errors`, `toCreate`,
  `alreadyExisting`, `conflicts`. The `.xlsx` reading (`read-excel-file`, already a dependency)
  is infrastructure, behind a port.
- **Stateless preview, confirm re-sends the file.** `POST /pm-plan-imports/preview` stores nothing.
  `POST /pm-plan-imports` takes the same file, re-checks it against the current state and, if it
  has no errors, adds every `toCreate` item in **one unit of work**; with errors it is a 400
  `pm-plan-import-has-errors` carrying the same `errors` list and adds nothing. The client is never
  trusted with the diff.
- **Rules** (approved assumptions a–f): a conflict is not an error — it is skipped and reported,
  the rest is added. Interval = integer > 0 (Persian digits allowed). An empty interval / first
  due date is an error only if its column / row holds a `+`. A deactivated earlier row does not
  block: a new active row is added. Any mark other than `+` (trimmed) is an error. A past first
  due date is accepted. A date like `1405/10/1` is read as `1405/10/01`. Unknown equipment or
  activity names are errors whether or not their row/column holds a `+`; a retired equipment is an
  error only if its row holds a `+`; a duplicate name is an error on **every** cell holding it.
- **Sheet**: the sheet named `pm` (trimmed, case-insensitive); otherwise the first sheet. A file
  that isn't a readable `.xlsx` is a 400 `pm-plan-import-file-unreadable`.
- **Roles**: `@Roles(Role.SystemAdmin)` — the Technical Manager may add items one by one but not
  import (403).

## Risks

- The real file (48 × 43, 1124 marks) means one confirm adds ~1100 items across 48 aggregates in
  one transaction; the handler loads each equipment once and saves each once.
- Date cells typed as real Excel dates (not text) — the reader converts a `Date` to its Jalali text
  so it is checked like any other.
