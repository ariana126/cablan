# Daily-BOM export: weight totals and deviation from standard — design

Issue #64. The "one row per daily BOM" Excel export (`هر آنالیز روزانه یک ردیف`) gains three
computed columns, a new column order, and a right-to-left sheet.

## Capability

For each exported daily BOM, show its total weight per metre, that total over the standard length,
and how far that is from the standard BOM's total over the same length — signed, two decimals.

## Scenarios (`acceptance-tests/specs/bom-reporting/exporting-bom.feature`)

None is UI-voiced beyond the existing export `When`, which already drives the browser's export
button; the change is entirely in the file the backend renders.

- خروجی اکسل با فرمت هر آنالیز روزانه یک ردیف (changed: column order + three new columns)
- محاسبه وزن 1 متر و وزن متراژ استاندارد (new outline)
- محاسبه اختلاف با استاندارد (new outline — positive / zero / negative)
- گرد شدن مقادیر اعشاری در خروجی هر آنالیز روزانه یک ردیف (new)

The approved proposal was drafted before the daily-BOM review feature renamed the approval columns
(`وضعیت تایید | تایید/رد کننده | توضیحات مدیریت`, values `تایید` / `در انتظار تایید`). Those
already-shipped names were kept; only the order and the three new columns were applied.

## Rules

- `وزن 1 متر` = Σ material weights of the daily BOM (all components).
- `وزن متراژ استاندارد` = `وزن 1 متر` × standard length.
- `اختلاف با استاندارد` = `وزن متراژ استاندارد` − (Σ material weights of the standard BOM with the
  same MI code, *current* weights) × standard length. Signed: heavier is positive.
- Computed on exact weights; only the displayed cell is rounded to two decimals (numeric cell,
  integers stay integers).
- A standard BOM that no longer exists (should not happen — the stakeholder says one in use can be
  neither edited nor deleted; that rule is a separate issue) yields `-` in the difference column
  rather than failing the export.

## Slice

- **Backend.** `ExportBomsHandler` enriches each `BomExportItem` with `weightPerMeter`,
  `standardLengthWeight` and `differenceFromStandard` (nullable), reading the standard BOM's total
  through the existing `StandardBomWeights` crossing (one lookup per distinct MI code). The
  per-BOM grid places `نام محصول, برند, متراژ استاندارد, وزن 1 متر, وزن متراژ استاندارد,
  اختلاف با استاندارد` after `کد MI`, rounds the three to 2 decimals, and the workbook for this
  format is rendered right-to-left (`renderXlsxWorkbook` gains an option). The per-material format
  is unchanged. No HTTP surface change — the endpoint and its query parameters stay as they are,
  so the OpenAPI spec does not move.
- **QA.** New `Given`s set a standard BOM's total weight (editing its weights through the API) and
  register a standard + daily BOM pair for MI `3001`; new `Then`s read single cells of the
  downloaded workbook by order number.
- **Frontend.** None — API-only change behind an existing button.

## Risks

- The standard BOM lookup per MI code adds query-bus round trips; bounded by distinct MI codes.
- Editing a standard BOM that has daily BOMs is still allowed today; the scenario's `Given` relies
  on that.
