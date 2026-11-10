# Orders page and equipment folder UX, missed occurrences in PM history — plan (issue #114)

Design: `docs/superpowers/specs/2026-11-10-orders-and-pm-history-ux-design.md`.

## Contract (pinned for all three agents)

`GET /api/equipment/:id/maintenance-history[?from=YYYY-MM-DD&to=YYYY-MM-DD]` → 200, array of:

| field | type | executed | missed |
|---|---|---|---|
| `kind` | `'executed' \| 'missed'` | `executed` | `missed` |
| `id` | `string \| null` | execution id | `null` |
| `planItemId` | `string` | ✓ | ✓ |
| `activityName` | `string` | snapshot | plan item's name |
| `activitySpecialty` | `'electrical' \| 'mechanical' \| null` | current | current |
| `dueDate` | `string` (ISO date) | ✓ | ✓ |
| `performedAt` | `string \| null` (ISO instant) | ✓ | `null` |
| `performedBy` | `string \| null` | ✓ | `null` |
| `status` | `'on_time' \| 'late' \| 'missed'` | on_time/late | `missed` |
| `notes` | `string \| null` | as recorded | `null` |
| `daysLate` | `number \| null` | late only | `null` |
| `operatingHours` | `number \| null` | as recorded | `null` |

Order: newest first by history date (executed: Tehran performed day then `performedAt`; missed: due
date), ties by `activityName`. Range: executed by Tehran performed day, missed by due date, both
inclusive; only one bound or `from > to` → 400 `validation-error`.

## QA (`acceptance-tests/`)

1. Automate the two new rules at the end of `recording-maintenance-execution.feature` (11 examples
   incl. the 3-row outline). New steps: «تخصص فعالیت "…" "…" باشد», «هیچ انجامی برای … ثبت نشده
   باشد», «… سابقه تعمیرات … را (با بازه "…" تا "…") مشاهده می کند», «وضعیت … برای موعد "…" در سابقه
   تعمیرات … "…" باشد», «انجام دهنده ای برای موعد "…" در سابقه تعمیرات … نباشد», the retirement /
   reactivation-with-continue and deactivation-on-day-by-persona preconditions (reuse existing ones
   where the wording already exists). Table columns «تخصص» (برق/مکانیک) and «وضعیت» «انجام نشده»;
   «-» for null performer/time. Compare order-insensitively.
2. Keep existing history assertions meaning "executed entries" where they say «انجام»; check «خالی»
   ones.
3. After the frontend lands: reconcile `ui/orders-page.ts` / `planning/orders-form.ts` with the
   modal (details in a `role="dialog"` named «جزئیات سفارش <n>»), and the history page object if the
   history is read through the UI.

## Backend (`backend/`, maintenance module)

1. Read model: widen `MaintenanceExecutionReadModel` per the contract (rename optional; keep the
   OpenAPI schema name stable if possible).
2. Handler: load equipment + its executions + catalog; for each plan item (active and inactive) use
   `Equipment.occurrencesOf(item, executionsOfItem)` (or the pure calculator) as of today to list
   occurrences with status `missed`; merge with executions; filter by range; sort.
3. Query + controller: `from`/`to` query DTO; OpenAPI regenerated.
4. Unit tests for every Gherkin example's shape (deactivation stop, service gap, deleted execution,
   next-due-date not reached, range rule).

## Frontend (`frontend/`)

1. Orders page per design decision 5 (modal, row click, hint, unified search like materials, drop
   daily-BOM column/filter/count statistic, MI-code row layout, spacing under the MI-code picker in
   the order form). Keep reload-after-change behaviour: modal shows the reloaded order; search kept
   after closing; opening another order shows only that order.
2. Equipment folder: specialty boxes side by side on desktop in «برنامه PM» and «فعالیت‌های
   غیرفعال»; history filters' layout fixed; history table shows missed rows (status «انجام نشده»,
   «-» for «انجام دهنده»/«زمان انجام»), visually distinct status; the «حذف سابقه» action only on
   executed rows; the date range is sent to the API (`from`/`to`); name search and specialty filter
   apply to both kinds.
3. Specs, `make lint-accessibility` green.
