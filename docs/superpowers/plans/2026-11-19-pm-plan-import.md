# Bulk import of PM plans from Excel — plan

Design: `docs/superpowers/specs/2026-11-19-pm-plan-import-design.md`. Issue #127.

## Pinned HTTP contract (System Admin only; anyone else 403)

Both endpoints take `multipart/form-data` with one field **`file`** (`.xlsx`, ≤ 5 MB).

`POST /api/pm-plan-imports/preview` → **200** `PmPlanImportPreview`; stores nothing.
`POST /api/pm-plan-imports` → **201** `PmPlanImportPreview` (the same shape, describing what was
just added); with errors → **400** `pm-plan-import-has-errors` (problem detail with an `errors`
extension, same element shape as below), nothing added.
Unreadable / missing file → **400** `pm-plan-import-file-unreadable`.

```jsonc
PmPlanImportPreview {
  "sheetName": "pm",
  "counts": { "toCreate": 2, "alreadyExisting": 0, "conflicts": 0, "errors": 0 },
  "errors": [ PmPlanImportError ],          // file order: by row, then column
  "toCreate": [ PmPlanImportItem ],
  "alreadyExisting": [ PmPlanImportItem ],
  "conflicts": [ PmPlanImportConflict ]
}
PmPlanImportError {
  "sheet": "pm", "cell": "D1", "row": 1, "column": "D",
  "value": "روغن کاری",          // the cell as text, "" when empty
  "reason": "activity-not-found", // code, see below
  "message": "فعالیت تعریف نشده است" // Persian, exactly as below
}
PmPlanImportItem {
  "cell": "C3", "equipmentId": "…", "equipmentName": "کمپرسور هوا",
  "activityId": "…", "activityName": "تعویض روغن",
  "intervalDays": 30, "firstDueDate": "2026-11-21"   // ISO, like every PM date
}
PmPlanImportConflict = PmPlanImportItem & {
  "existingIntervalDays": 15, "existingFirstDueDate": "2026-11-21",
  "differences": ["intervalDays" | "firstDueDate", …]
}
```

| `reason` | `message` | Cell |
|---|---|---|
| `equipment-not-found` | تجهیز تعریف نشده است | A<row> |
| `activity-not-found` | فعالیت تعریف نشده است | <col>1 |
| `equipment-retired` | تجهیز کنار گذاشته شده است | A<row> (only if the row has a `+`) |
| `duplicate-equipment-in-file` | تجهیز در فایل تکرار شده است | every A<row> holding it |
| `duplicate-activity-in-file` | فعالیت در فایل تکرار شده است | every <col>1 holding it |
| `first-due-date-required` | اولین موعد خالی است | B<row> (row has a `+`) |
| `invalid-jalali-date` | تاریخ شمسی نامعتبر است | B<row> |
| `interval-required` | دوره خالی است | <col>2 (column has a `+`) |
| `interval-not-positive-integer` | دوره باید عدد صحیح مثبت باشد | <col>2 |
| `invalid-mark` | علامت نامعتبر است | the crossing |
| `equipment-name-required` | نام تجهیز خالی است | A<row> (row has a `+` but no name) |
| `activity-name-required` | نام فعالیت خالی است | <col>1 (column has a `+` but no name) |

Classification of each valid `+`: no active item for that activity on that equipment → `toCreate`;
an active item with the same `intervalDays` (its current interval) and `firstDueDate` →
`alreadyExisting`; otherwise → `conflicts` (not added, existing item untouched). Names are
compared trimmed, Persian/Latin digits normalised.

## QA (`qa-engineer`)
Automate every scenario of `importing-pm-plans.feature`. The workbook is built from the Gherkin
table: sheet `pm`; row 1 = `تجهیز`, `اولین موعد`, then each activity name (the header
«تعویض روغن (30 روز)» splits into name and interval); row 2 = blank, blank, the intervals; rows 3+
= the Gherkin rows. Cell addresses in the Gherkin follow that layout. UI for the active
«بارگذاری (و تایید) می کند» steps on `/pm-plans` («بارگذاری از اکسل»); API for the «تلاش …»
outline and preconditions; facts via `GET equipment/:id` as an observer.

## Backend (`backend-engineer`)
Domain: pure sheet check (grid in → errors/toCreate/alreadyExisting/conflicts), Jalali parsing
(reuse the module's calendar-date/Jalali helpers if any; `1405/10/1` valid, `1405/13/01` invalid).
Application: `PreviewPmPlanImportQuery`, `ImportPmPlansCommand` (one unit of work; each equipment
loaded and saved once; existing `addPlanItem` + its events/audit). Infrastructure: controller,
`.xlsx` reader port adapter, exception mapper entries, OpenAPI regenerated.

## Frontend (`frontend-engineer`)
On `/pm-plans` (board), a «بارگذاری از اکسل» button for the System Admin only. Opens a file chooser,
calls preview, shows a dialog: «N برنامه قابل ثبت است», the errors table (columns «شیت», «خانه»,
«ردیف», «ستون», «مقدار», «علت»), the «از قبل موجود» table and the «اختلاف با برنامه موجود» table
(«تجهیز», «فعالیت», «اختلاف» — «دوره» / «اولین موعد», with file vs existing values), and «تایید»
(disabled while errors exist) / «انصراف». Confirm re-sends the file and shows the result, then
refreshes the board. Dates shown Jalali.
