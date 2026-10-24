# Persian-digit input — design (issue #62)

## Capability

Digits a user types on a Persian keyboard (`۰`–`۹`, and the Arabic-Indic `٠`–`٩` some keyboards
emit) are stored and shown as English digits (`0`–`9`) in every identifier and free-text field, so
`۱۲۳۴` and `1234` are one value — for uniqueness, for lookups and for search. Quantities, weights,
lengths, Jalali dates and paginator numbers keep their current Persian rendering (stakeholder
decision on #62); nothing about them changes.

Fields covered: daily BOM order number, tracking number, description, and the MI code it is
registered against; standard BOM MI code and brand; material code and name; product name;
component name; username (registration, edit and login).

## Scenarios

All approved on #62 and added verbatim:

- `bom-registration/registring-bom.feature` — «ثبت آنالیز روزانه با رقم فارسی» (outline: order
  number, tracking number, description), «ثبت آنالیز روزانه با رقم انگلیسی», «ویرایش شماره سفارش
  با رقم فارسی», «ثبت آنالیز روزانه برای کد MI وارد شده با رقم فارسی».
- `bom-registration/registring-standard-bom.feature` — «ثبت کد MI با رقم فارسی», «ثبت کد MI
  تکراری با رقم فارسی».
- `bom-registration/registring-material.feature` — «ثبت مواد اولیه با رقم فارسی» (outline: code,
  name), «ثبت مواد اولیه با کد تکراری با رقم فارسی».
- `bom-registration/registring-product.feature` — «ثبت محصول با رقم فارسی در نام».
- `bom-registration/registring-component.feature` — «ثبت جز با رقم فارسی در نام».
- `authentication/registring-user.feature` — «ثبت نام کاربری با رقم فارسی», «ثبت کاربر با نام
  کاربری تکراری با رقم فارسی».
- `authentication/logging-in.feature` — «ورود با نام کاربری تایپ شده با رقم فارسی».
- `bom-reporting/reporting-bom-persian-digits.feature` (new file) — «جستجوی مقدار فیلتر با رقم
  فارسی» (outline: order number, tracking number, MI code). **UI-voiced**: the search box inside
  the Excel-style filter menu. It lives in its own file because `reporting-bom.feature`'s
  Background seeds MI code `1001` and tracking number `TRK-3002` on other rows, which would
  contradict this outline's expected results.

Several approved scenarios repeat their feature's Background givens (log-in, the seeded standard
BOM / product). The text stays as approved; the automation makes those givens idempotent.

## Slice and decisions

- **Normalisation lives in the backend domain**, not the client: one pure shared function
  (`Persian/Arabic-Indic digits → ASCII`, nothing else touched) applied where each value object /
  aggregate field is constructed, so create, update, uniqueness checks and lookups (MI code on
  daily BOM registration, username on login) all see the normalised value. Any client — the app,
  a script, the API directly — gets the same behaviour.
- **No HTTP surface change.** No new endpoints, fields or problem types; the existing duplicate
  problem types now also fire for a Persian-digit duplicate. The OpenAPI spec does not change.
- **Existing data is normalised once by a Prisma migration.** Non-unique columns (order number,
  tracking number, description, brand, …) are translated unconditionally. Unique columns (MI code,
  material code and name, product name, component name, username) are translated only where the
  result collides with no other row; colliding rows are left untouched and listed with
  `RAISE NOTICE` in the migration output, for the stakeholder to resolve by hand, as agreed on #62.
- **Frontend**: the filter-menu search is already digit-insensitive (`normalizeForSearch`); the UI
  slice is to confirm that for the order-number, tracking-number and MI-code filters and close any
  gap. No display change — the values arrive already normalised.

## Risks

- A stored copy of a normalised value elsewhere (a read-model or snapshot column) would keep
  Persian digits; the migration must cover every column that holds one of these fields.
- Audit-log history keeps what was recorded at the time; it is history, not current data, and is
  deliberately not rewritten.
