# Daily-BOM export weight totals — plan

Design: `docs/superpowers/specs/2026-10-25-export-bom-weight-totals-design.md`.

## QA (`acceptance-tests/`)

1. Automate the four changed/new scenarios of `specs/bom-reporting/exporting-bom.feature`.
2. `Given` «آنالیز استاندارد با کد MI "X" با مجموع وزن مواد اولیه N در سیستم ثبت شده باشد» —
   API: edit the existing standard BOM's material weights so they sum to N.
3. `Given` «آنالیز استاندارد با کد MI "X" و متراژ استاندارد L با مجموع وزن مواد اولیه N …» and
   «آنالیز روزانه با شماره سفارش "O" برای کد MI "X" با یک مواد اولیه به وزن W …» — API.
4. `Then`s read the per-BOM workbook's cells by header name for the row with the given order
   number; compare as displayed text (`305`, `-610`, `129.23`).

## Backend (`backend/`)

1. `BomExportItem` + `weightPerMeter: number`, `standardLengthWeight: number`,
   `differenceFromStandard: number | null`.
2. `ExportBomsHandler` computes them; standard total via `StandardBomWeights` (add a total accessor
   on `StandardWeightTable`), memoised per MI code; `EntityNotFound` → `null`.
3. `bom-export-grid.ts`: per-BOM column order
   `شماره سفارش, شماره ردیابی, تاریخ و زمان ثبت, کنترلگر, کد MI, نام محصول, برند, متراژ استاندارد,
   وزن 1 متر, وزن متراژ استاندارد, اختلاف با استاندارد, توضیحات, وضعیت تایید, تایید/رد کننده,
   توضیحات مدیریت, جز ۱ …`; values rounded to 2 decimals; null → `-`. Per-material unchanged.
4. `renderXlsxWorkbook` option for a right-to-left sheet view; the per-BOM export uses it.
5. Unit tests for each; no OpenAPI change expected (verify with `make lint-swagger`).

## Frontend

None.
