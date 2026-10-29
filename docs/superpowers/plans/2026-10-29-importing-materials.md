# Importing materials from the accounting Excel — plan

Design: `docs/superpowers/specs/2026-10-29-importing-materials-design.md`. Issue #74.

## HTTP contract (shared by every agent — field names are fixed)

All under `/api`, bearer auth. Import endpoints: `Role.Management` and `Role.SystemAdmin`;
reversion: `Role.SystemAdmin` only. Problem types are `https://my-api-doc.dev/problems/<slug>`.

### `POST /materials/import-preview` — multipart, field `file`

200 `MaterialImportPreview`:

```json
{ "changes": [
  { "row": 3, "kind": "register", "name": "آلومینیوم", "code": "A-1",
    "materialId": null, "previousName": null, "previousCode": null, "errors": [] },
  { "row": 4, "kind": "changeCode", "name": "مسی", "code": "M-201",
    "materialId": "<uuid>", "previousName": "مسی", "previousCode": "M-101", "errors": [] },
  { "row": 5, "kind": "rename", "name": "برنج زرد", "code": "B-1",
    "materialId": "<uuid>", "previousName": "برنج", "previousCode": "B-1", "errors": [] }
] }
```

- `kind`: `register | changeCode | rename | unchanged | invalid`. `unchanged` rows appear only when
  they carry errors; `invalid` = name or code missing. Order = file order.
- `name`/`code`: normalised (trimmed, ASCII digits); `''` when missing.
- `errors[]`: `name-required | code-required | duplicate-name-in-file | duplicate-code-in-file |
  code-taken | material-targeted-twice`.
- 400 `material-import-file-unreadable` (not an xlsx / no header row with «کد کالا» and «نام کالا»).
- 403 for سینا/نیکروش's roles.

### `POST /materials/imports` — JSON

Request `ConfirmMaterialImportDto`: `{ "rows": [ { "row": 3, "name": "آلومینیوم", "code": "A-1" } ] }`
(the rows the visitor kept; `row` is only echoed back in errors).

- 201 `{ "id": "<import uuid>" }`.
- 400 `material-import-has-invalid-rows`, extension `rows: [{ row, name, code, errors: [...] }]`
  (same error codes) — nothing written.
- 400 `material-import-empty` when no kept row changes anything.
- 400 `validation-error` for a malformed body; 403.

### `POST /materials/imports/{id}/reversion`

- 204. System admin only, else 403.
- 404 `material-import-not-found`.
- 409 `material-import-not-latest` — a later, not-reverted import exists.
- 409 `material-import-already-reverted`.
- 409 `material-import-not-revertible` — a registered material is used by a product; a touched
  material was deleted or no longer has the name/code the import left it with; a name/code to
  restore is held by another material.

### Audit log (existing endpoints, new values)

`recordType` gains `MaterialImport`; `action` gains `Imported`, `Reverted`. Entry `recordId` = the
import id; actor = whoever confirmed/reverted. Change lines (file order):

| change | field | previousValue | newValue |
|---|---|---|---|
| register | `importedMaterial:<code>` | `''` | `<name>` |
| code change | `materialCode:<name>` | old code | new code |
| rename | `materialName:<code>` | old name | new name |

`Reverted` repeats the import's lines with previous/new swapped. No per-material
`Material Registered/Edited` entries are written for an import or a revert.

## Backend (`backend-engineer`)

1. Domain (products): `MaterialImport` aggregate + `MaterialImportChange` value object
   (`kind`, `materialId`, `previousName`, `previousCode`, `name`, `code`); events
   `MaterialsImported`, `MaterialImportReverted` carrying the change lines; a pure classifier
   (`classifyMaterialImportRows(rows, existingMaterials)`) producing the preview items and errors;
   `MaterialImportRepository` port (find latest not reverted, find by id, save). A way for the
   `Material` aggregate to be registered/edited/deleted by an import **without** emitting its
   per-material audit events.
2. Application: `PreviewMaterialImportQuery` (rows in → preview), `ConfirmMaterialImportCommand`,
   `RevertMaterialImportCommand`, the exceptions above; a spreadsheet-reading port in application,
   implemented in infrastructure with `read-excel-file` (header-row search, row numbers as Excel's).
   Product-usage check for the revert (`ProductRepository` — materialId in any composition line).
3. Infrastructure: Prisma `material_import` (+ changes as JSON or child table, `sequence`
   autoincrement), migration; controller routes above (multer `FileInterceptor('file')`, 5 MB);
   exception mapper; audit-logging handlers for the two events (new recordType/actions in the enum
   + migration); OpenAPI regenerated. Integration test: confirm and revert are atomic.

## QA (`qa-engineer`)

Automate both feature files' new scenarios. Build `.xlsx` files from the Gherkin rows (add a
writer dependency such as `write-excel-file`), shaped like the accounting export: blank row 1,
header row 2 «ردیف، نوع، کد کالا، نام کالا، واحد», data from row 3. Doors per
`acceptance-tests/CLAUDE.md`: UI for the active uploads / remove-and-confirm / revert, API for
passive `Given`s and «تلاش …» attempts; outcome `Then`s may read `GET materials` / the audit log.

## Frontend (`frontend-engineer`)

`/materials`: «بارگذاری از اکسل» button (hidden file input with a real `<label>`/button), change-list
dialog (row number, Persian description, Persian errors, per-row «حذف», «تایید», «انصراف», empty
state «تغییری وجود ندارد»), invalid-rows 400 marks rows and keeps the dialog open.
Audit log: labels for `MaterialImport`, `Imported`, `Reverted` and the three line keys as sentences;
«برگرداندن» in an `Imported` entry's details for the system admin, Persian messages for the 409s.
Persian error texts:

| error | text |
|---|---|
| `name-required` | «اسم مواد اولیه خالی است» |
| `code-required` | «کد مواد اولیه خالی است» |
| `duplicate-name-in-file` | «اسم مواد اولیه در اکسل تکراری است» |
| `duplicate-code-in-file` | «کد مواد اولیه در اکسل تکراری است» |
| `code-taken` | «کد مواد اولیه تکراری است و متعلق به مواد اولیه دیگری است» |
| `material-targeted-twice` | «این مواد اولیه در چند ردیف اکسل تغییر کرده است» |
