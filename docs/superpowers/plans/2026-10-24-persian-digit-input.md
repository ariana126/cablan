# Persian-digit input — plan (issue #62)

Design: `docs/superpowers/specs/2026-10-24-persian-digit-input-design.md`.

No request/response body changes: every task below works against the existing fields.

## QA (`acceptance-tests/`)

1. Automate every new scenario listed in the design. New step phrasings to bind (reuse existing
   steps wherever the phrasing already exists):
   - `نیکروش آنالیز روزانه جدیدی برای کد MI {string} با <شماره سفارش|شماره ردیابی|توضیحات> {string} ثبت می کند`
     and its expectation `آنالیز روزانه جدیدی با <field> {string} در سیستم ثبت شده باشد`.
   - `نیکروش شماره سفارش آن را به {string} تغییر می دهد` / `آنالیز روزانه با شماره سفارش {string} در سیستم ثبت شده باشد`.
   - `آنالیز روزانه جدیدی برای کد MI {string} ثبت شده باشد`.
   - `مصطفی آنالیز استاندارد جدیدی با کد MI {string} برای محصول {string} ثبت می کند` / `آنالیز استاندارد جدیدی با کد MI {string} ثبت شده باشد`.
   - `مصطفی مواد اولیه جدیدی با <کد|اسم> {string} ثبت می کند` / `مواد اولیه جدیدی با <کد|اسم> {string} در سیستم ثبت شده باشد`.
   - `مصطفی محصول جدیدی با نام {string} ثبت می کند` / `محصول جدیدی با نام {string} ...`; same for جز.
   - `یاشار کاربر جدیدی با نام کاربری {string} ثبت می کند` / `کاربر جدیدی با نام کاربری {string} ...`.
   - `سینا با نام کاربری {string} در سیستم ثبت شده باشد`, `سینا با نام کاربری {string} و رمز عبور درست وارد سیستم می شود`, `سینا وارد سیستم شده باشد` (as an outcome).
   - `آنالیز های روزانه زیر در سیستم ثبت شده باشند:` (order/tracking/MI columns only; fill the rest
     with defaults) and `سینا لیست آنالیز های روزانه را با جستجوی {string} در فیلتر {string} مشاهده می کند` — through the browser: type into the filter menu's search box, select what it shows, apply.
2. Givens repeated from a Background (log-in, seeded standard BOM `0001`, seeded product) must be
   idempotent within a scenario.
3. Assertions read the stored value back over HTTP, so they prove storage, not echo.

## Backend (`backend/`)

1. Shared pure function in the framework/shared kernel: Persian (`U+06F0–06F9`) and Arabic-Indic
   (`U+0660–0669`) digits → ASCII; every other character unchanged. Unit-tested.
2. Apply it at construction of: daily BOM order number, tracking number, description, and the MI
   code used to find the standard BOM on daily-BOM create/update; standard BOM MI code and brand;
   material code and name; product name; component name; user username (create, update) and the
   username looked up at login. Uniqueness checks then compare normalised values automatically.
3. Prisma migration normalising existing rows: unconditional for non-unique columns; for unique
   columns only where no collision results, `RAISE NOTICE` for each skipped row. Covers every
   column that stores one of these values (including any denormalised copy).
4. OpenAPI unchanged; `make lint-swagger` stays green.

## Frontend (`frontend/`)

1. Confirm the filter-menu search folds Persian digits for the order-number, tracking-number and
   MI-code filters on the daily BOM list (`normalizeForSearch`); fix any gap, with a spec.
2. Check no client-side check (e.g. duplicate detection or validation pattern) rejects or
   distinguishes Persian-digit input before it reaches the API; fix any it finds.
