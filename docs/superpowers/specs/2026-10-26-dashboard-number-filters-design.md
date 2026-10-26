# Dashboard order/tracking-number filters and tracking-number display — design

Issue #70. The daily-review dashboard gains two free-text filters — «شماره سفارش» and
«شماره ردیابی» — and shows each daily BOM's tracking number next to its order number.

## Scenarios (`acceptance-tests/specs/bom-analyzing/bom-dashboard.feature`)

Background: the daily-BOM table gains a «شماره ردیابی» column (TRK-6001 … TRK-6005). No existing
outcome changes.

New rule «… با وارد کردن تمام یا بخشی از شماره سفارش یا شماره ردیابی فیلتر کرد», all UI-voiced:

- فیلتر لیست محصولات داشبورد بر اساس شماره سفارش یا شماره ردیابی (outline, 3 examples)
- فیلتر آنالیز های روزانه یک محصول بر اساس شماره سفارش یا شماره ردیابی (outline, 4 examples)
- فیلتر شماره ردیابی فیلتر پیش فرض وضعیت تایید را کنار نمی گذارد
- فیلتر شماره ردیابی بازه زمانی را کنار نمی گذارد
- فیلتر همزمان شماره سفارش و شماره ردیابی فقط آنالیز های جور با هر دو را نشان می دهد
- فیلتر با شماره ردیابی ای که هیچ آنالیز روزانه ای ندارد

New rule «… شماره ردیابی هر آنالیز روزانه را نشان می دهد», UI-voiced:

- مشاهده شماره ردیابی آنالیز های روزانه یک محصول

## Slice

- **Backend.** No domain change — this is a read-model filter. `POST /api/boms/dashboard` and
  `POST /api/boms/dashboard/{productId}/daily-boms` accept two optional strings, `orderNumber` and
  `trackingNumber`. Each is trimmed; blank or absent means unfiltered; otherwise a BOM matches when
  its number **contains** the text, case-insensitively (substring anywhere, per the approved
  assumption). They AND with the date range, `approvalStatuses` and `reviewers`, exactly like the
  existing filters, in the same dashboard repository query. The daily-BOM response already carries
  `trackingNumber`, so no response change.
- **Frontend.** Two Material text fields (`<mat-label>` «شماره سفارش» / «شماره ردیابی») in the
  dashboard's filter bar, feeding both requests; the daily-BOM table/list shows a «شماره ردیابی»
  value beside the order number. Input is debounced or applied like the existing filters.
- **QA.** Seed tracking numbers from the background column; new steps for «جست و جوی "…" در فیلتر
  "…"» (one or two pairs) for both the product list and a product's daily BOMs; a question reading
  the tracking number per order number.

## Decisions

- Single text value per field, not multi-value (approved assumption). Substring, case-insensitive.
- No default for either field; the default «در انتظار تایید» status filter stays applied.
