# Orders page and equipment folder UX, missed occurrences in PM history — design (issue #114)

## Capability

Two pages get easier to use, and one read gets a new business meaning:

- **«سفارشات»** (`/orders`): the order details open in a modal by clicking anywhere on a row, one
  shared search box for order number and product name, no daily-BOM filter, no daily-BOM count as a
  statistic, and better spacing in the order form and in the details' MI-code list. **No rule
  changes**: edit/delete restrictions and warnings for orders with daily BOMs stay.
- **«پرونده فنی تجهیزات»** (`/pm-plans/:equipmentId`): electrical and mechanical boxes side by side
  on desktop in «برنامه PM» and «فعالیت‌های غیرفعال», stacked on narrow screens; the PM-history
  filters (search, date range, specialty) laid out cleanly in one row/wrap.
- **«سابقه PM» now includes missed occurrences** — the approved Gherkin (stakeholder comment
  2026-11-10 07:44) adds two rules to
  `maintenance-management/recording-maintenance-execution.feature`:
  1. «سابقه تعمیرات هر تجهیز موعدهایی را که تا رسیدن موعد بعدی انجام نشده اند با وضعیت انجام نشده
     نشان می دهد» — examples: each missed occurrence separately; on-time, late and missed side by
     side once each; not-yet-missed (outline: today 07/01, 07/05, 07/07) → empty; becomes missed on
     the next due date; deactivated activity → only due dates up to deactivation; retired period →
     not listed; execution deleted by the System Admin → missed.
  2. «در بازه زمانی سابقه تعمیرات، موعدهای انجام نشده بر اساس تاریخ موعد و موعدهای انجام شده بر
     اساس روز انجام انتخاب می شوند» — two examples with «… را با بازه "…" تا "…" مشاهده می کند».

  The «… سابقه تعمیرات اکسترودر 1 را مشاهده می کند» `When`s are UI-voiced in tone, but every `Then`
  is a fact about the history; QA chooses the door per its CLAUDE.md (the history API is the fact
  source either way).

## Slice

- **Backend (maintenance module):** `GetEquipmentMaintenanceHistoryHandler` merges executions with
  the **missed** occurrences of every plan item of the equipment (deactivated items and service gaps
  respected) — computed, never stored, by the existing calculator: `Equipment.occurrencesOf(item,
  executions)` already builds the history view with deactivation stop and every service gap, and
  `pm-occurrences.ts` already yields `missed`. Only occurrences whose status is `missed` are added;
  `due`, `overdue`, `upcoming` never appear. Optional `from`/`to` query parameters filter: an
  executed entry by its Tehran performed day, a missed one by its due date.
- **Frontend:** orders page rework; folder layout; history table renders missed rows (status «انجام
  نشده», «-» for performer/time) and sends the range to the API.
- **Acceptance tests:** automate the eleven new examples; keep every existing history assertion
  green (those about «انجام» / «سابقه انجام» are about executed entries only); reconcile
  `ui/orders-page.ts` and `orders-form.ts` with the modal markup.

## Decisions

1. **Same endpoint, widened entries** — `GET /equipment/:id/maintenance-history` keeps its array;
   each entry gains `kind: 'executed' | 'missed'`; `status` gains `'missed'`; `id`, `performedAt`,
   `performedBy` become nullable (null exactly when `kind = 'missed'`), as do `notes`, `daysLate`,
   `operatingHours` (already nullable). A missed entry's `activityName` is the plan item's current
   name, `activitySpecialty` the catalog's current one (as today).
2. **Order** — newest first by the entry's *history date* (executed: Tehran performed day, then
   `performedAt`; missed: due date); ties by activity name. The Gherkin tables list oldest first;
   QA compares them order-insensitively (both sides sorted by due date, then activity).
3. **Range** — `from`/`to` ISO `YYYY-MM-DD`, both or neither, inclusive; validated like the other
   calendar-date params (`IsCalendarDate`); one without the other, or `from > to` → 400
   `validation-error`. Without them, everything.
4. **Deleted executions** need nothing special: a deleted execution simply leaves its occurrence
   unexecuted, and the calculator calls it missed once the next due date has come.
5. **Orders modal** — `MatDialog` (closes on backdrop click, the default; Escape too), headed «جزئیات
   سفارش <n>», holding the MI-code list (one row per code: code, then product name, gap between,
   name wrapping inside its own cell, never pushed to a separate line on desktop) and the actions
   allowed for the role. Rows: whole row clickable (`cursor: pointer`), keyboard reachable via the
   order-number cell's button «جزئیات سفارش <n>» (kept for accessibility and the suite); no eye
   icon; a hint above the table «برای مشاهده جزئیات هر سفارش روی ردیف آن کلیک کنید.». Search box
   «جست‌وجوی سفارش» matching order number or any product name, styled like the materials page's.
   Columns: شماره سفارش, محصول, تعداد کد MI — the daily-BOM column and filter go. The dependency
   reason text in the modal may still state the count (it is a warning, not a statistic).
6. **Folder boxes** — a CSS grid of two equal columns ≥ a desktop breakpoint, one column below;
   each specialty is a bordered card with its heading; `min-width: 0` and wrapping names so long
   names never overflow; «تخصص تعیین نشده» spans full width when present.

## Risks

- **Existing «خالی» assertions** (`registring-equipment`, deletion scenarios) now count missed
  entries too; QA verifies each still holds at its scenario's «today» or reports it.
- **Locator drift on `/orders`**: the details become a dialog; the overlay hides the page from role
  locators while open (see acceptance-tests CLAUDE.md), so actions must be found inside the dialog.
- **Accessibility**: the clickable row must not become a `div` click target only — the button in
  the first cell remains the keyboard path.
