# Importing materials from the accounting Excel — design

Issue #74. Management (مصطفی) or the system admin (یاشار) uploads the item list exported by the
accounting software. The system compares it with the registered materials and shows a **change
list** — new materials, code changes, renames — with problem rows marked. The visitor removes the
rows they don't want and confirms; the remaining changes apply **all together or not at all**, as
one **bulk-import** («بارگذاری گروهی») audit event. The system admin can **revert** the latest
import, as long as nothing it touched has changed or been used since.

## Scenarios

`acceptance-tests/specs/bom-registration/importing-materials.feature` (new, verbatim from the
approved proposal):

- Rule «هر ردیف اکسل اول از روی نام و سپس از روی کد …» — «تشخیص تغییر یک ردیف اکسل» (outline),
  «ردیف بدون تغییر در لیست تغییرات نمی آید».
- Rule «مواد اولیه ای که در اکسل نیستند دست نخورده می مانند» — «بارگذاری اکسلی که مواد اولیه موجود را ندارد».
- Rule «فقط تغییراتی اعمال می شوند که کاربر … نگه داشته است» — «حذف چند ردیف از لیست تغییرات پیش از تایید».
- Rule «ردیف های مشکل دار …» — code belongs to another material, duplicate name in file, duplicate
  code in file, row without code, row without name.
- Rule «… به طور کامل اعمال می شود یا هیچ بخشی …» — confirm with an error row; confirm after removing it.
- Rule «رقم های … با رقم انگلیسی …» — outline of three.
- Rule «فقط مدیریت و مدیر سیستم …» — access-denied outline (سینا, نیکروش).

`acceptance-tests/specs/audit-logging/viewing-audit-log.feature` (new rules appended):

- «ثبت رویداد بارگذاری گروهی».
- «برگرداندن آخرین بارگذاری گروهی», «بارگذاری گروهی قبلی تا وقتی بارگذاری بعدی برنگشته …»,
  «برگرداندن بارگذاری گروهی قبلی پس از برگرداندن بارگذاری بعدی».
- «تلاش برای برگرداندن بارگذاری گروهی پس از تغییرات بعدی» (outline of three).
- «تلاش کاربر بدون دسترسی برای برگرداندن بارگذاری گروهی» (مصطفی, سینا, نیکروش).

**UI-voiced**: the active non-«تلاش» `When`s — uploading a file and reading its change list,
removing rows and confirming, and «یاشار آن بارگذاری گروهی را برمی گرداند». So the feature gets
UI. Which examples QA drives through the browser vs. the API is QA's call under
`acceptance-tests/CLAUDE.md`'s door rules; the backend rules (classification, errors, all-or-nothing,
revert guards, 403s) are all reachable over HTTP.

## The file

The accounting export (sample `Book1.xlsx`) is one sheet whose **header row is not row 1** (row 1 is
blank, row 2 holds «ردیف، نوع، کد کالا، نام کالا، واحد، …»), followed by ~225 data rows. Codes look
like `01/01/101` and are text cells. So the parser:

- reads the first sheet with `read-excel-file` (already a backend dependency);
- finds the header row as the first row containing both «کد کالا» and «نام کالا» (cells trimmed),
  and takes those two columns by position; every other column is ignored;
- treats each later row as one item, skipping only rows where **both** cells are empty; the row
  number reported to the visitor is the spreadsheet row number (1-based, as Excel shows it);
- reads a numeric cell as its text form (`String(value)`), trims, and normalises digits with
  `toAsciiDigits` — the same normalisation `MaterialName`/`MaterialCode` apply.

A file that isn't a readable `.xlsx`, or has no such header row, is a 400
`material-import-file-unreadable`.

## Classification (per row, after normalisation)

Against the materials currently registered:

1. name matches a material → same code: **unchanged** (omitted unless it carries an error);
   different code: **changeCode** of that material — error `code-taken` if the new code belongs to
   another material.
2. name unknown, code matches a material → **rename** of that material to the row's name.
3. neither → **register** a new material.

Row errors (a row may carry several): `name-required`, `code-required` (such a row has kind
`invalid`), `duplicate-name-in-file`, `duplicate-code-in-file` (every row sharing it is marked),
`code-taken` (as above), `material-targeted-twice` (two rows resolve to the same existing
material, e.g. a code change and a rename of it — every such row marked). Materials absent from
the file are untouched; there is no delete.

## Decisions

- **Behaviour lives in the `products` module**, next to `Material`. A new aggregate
  **`MaterialImport`** records one confirmed import: id, the applied changes (kind, materialId,
  name/code before and after), who/when (`importedAt`), and `revertedAt`. It is the unit the audit
  entry and the revert refer to; its id is the audit entry's `recordId`.
- **Preview is stateless.** `POST /materials/import-preview` parses and classifies and stores
  nothing. Confirm sends back the rows the visitor kept as JSON; the server **re-classifies them
  against the current state** and re-validates — the client is never trusted with the diff.
- **All or nothing.** If any kept row has an error (or is `invalid`), the confirm is a 400
  `material-import-has-invalid-rows` listing them, and nothing is written. Otherwise every change
  plus the `MaterialImport` plus its audit entry commit in one transaction (ADR 0007). Unchanged
  rows are ignored. A confirm with no effective change is a 400 `material-import-empty`.
- **One audit entry per import, none per material.** The materials it registers/edits must not
  also emit their own `MaterialRegistered`/`MaterialEdited` audit entries (stakeholder assumption 3).
  New audit `recordType` **`MaterialImport`**, actions **`Imported`** and **`Reverted`**; change
  lines, in file order:
  - register: `field: 'importedMaterial:<code>'`, `previousValue: ''`, `newValue: <name>`;
  - code change: `field: 'materialCode:<name>'`, previous/new the codes;
  - rename: `field: 'materialName:<code>'`, previous/new the names.

  A `Reverted` entry lists the same lines with previous/new swapped (a registered material's line
  becomes `<name>` → `''`).
- **Revert**: `POST /materials/imports/{id}/reversion`, system admin only (403 otherwise). It
  succeeds only for the **latest not-yet-reverted** import (409 `material-import-not-latest`
  otherwise; 409 `material-import-already-reverted` for one already reverted). It is refused, with
  nothing changed, by 409 `material-import-not-revertible` when any of: a material it registered
  is used in a product's composition; a material it touched no longer exists or no longer has the
  name/code the import left it with; a name or code it would restore is now held by another
  material. On success every change is undone in one transaction and the `Reverted` audit entry is
  written. A revert can't itself be reverted. "Latest" is by `importedAt`, then an insertion
  `sequence` (the test clock is frozen).
- Synchronous throughout. Upload is `multipart/form-data`, field `file`, capped at 5 MB.

## UI

- `/materials` gains an «بارگذاری از اکسل» button (management + system admin). It picks a file and
  opens a **change-list dialog**: one row per change with its spreadsheet row number, a Persian
  description («ثبت مواد اولیه جدید "آلومینیوم" با کد "A-1"», «تغییر کد "مسی" از "M-101" به
  "M-201"», «تغییر نام کد "B-1" از "برنج" به "برنج زرد"»), its errors in Persian, and a
  «حذف» button per row. An empty list says so. «تایید» confirms; a 400 with invalid rows keeps the
  dialog open and marks those rows; success closes it and refreshes the list.
- The audit log renders `MaterialImport` as «بارگذاری گروهی», `Imported`/`Reverted` as
  «بارگذاری گروهی»/«برگرداندن», and the three line keys as sentences
  («ثبت مواد اولیه جدید با نام "آلومینیوم" و کد "A-1"», «تغییر کد مواد اولیه "مسی" از … به …»,
  «تغییر نام مواد اولیه با کد "B-1" از … به …»). An `Imported` entry's details dialog offers the
  system admin a «برگرداندن» button, with the 409s shown as Persian messages.

## Risks

- Suppressing per-material audit entries while still going through the `Material` aggregate.
- Order of applying changes within one transaction against the `@unique` indexes (a code freed by
  one row can't be taken by another — that is already a `code-taken` error at classification, so
  apply order is free, but revert must restore codes in an order the indexes accept).
- QA has to produce real `.xlsx` files from Gherkin rows (the acceptance suite has
  `read-excel-file` only; it needs a writer such as `write-excel-file`).
