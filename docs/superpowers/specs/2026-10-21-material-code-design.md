# Material code: required and unique — design

Issue #51. A raw material's code becomes, like its name, **required and unique**: nobody can
register a material without a code or with another material's code, and nobody can clear an
existing material's code or change it to another material's. The materials list and the
register/edit dialog show the code **before** the name, and the product-registration material
picker stops displaying the code while still matching on it when searching.

## Scenarios (`acceptance-tests/specs/bom-registration/registring-material.feature`)

Added verbatim from the approved proposal, mirroring the existing name rules:

- Rule «کد مواد اولیه نباید خالی باشد» — «ثبت مواد اولیه بدون کد», «پاک کردن کد مواد اولیه».
- Rule «کد هر مواد اولیه باید یونیک باشد» — «ثبت مواد اولیه با کد تکراری»,
  «ویرایش مواد اولیه با کد تکراری».

They take the same door as their name counterparts: the two "empty" examples are voiced like the
name ones (the visitor fills the form and leaves a field blank — UI-voiced); the duplicate ones
follow whatever door the duplicate-name examples already use.

## Slice

- **Backend (products module).** `Material.code` stops being optional: a non-blank, trimmed
  string. `POST /api/materials` and `PATCH /api/materials/{id}` both require `code` (no longer
  nullable; blank/whitespace-only → the existing `validation-error` 400 with field `code`).
  Uniqueness is a new application exception, mirroring `MaterialNameAlreadyExists`:
  **409 `https://my-api-doc.dev/problems/material-code-already-exists`**, title
  `Material Code Already Exists`, extension member `code`. Prisma: `code String @unique`, via a
  migration. The stakeholder confirmed every production material already has a unique code, so
  the migration needs no backfill.
- **Frontend.** Materials list: code column first, then name. Register/edit dialog: code field
  first, then name; code required (Persian error under the field) and the 409 duplicate-code
  problem shown as a Persian field error, the same way duplicate name is. Product registration's
  material picker: shows the name only, filters on name **or** code.
- **QA.** Automate the four new examples; every existing material fixture/test-data builder must
  now send a unique code, since materials without one are rejected.

## Decisions

- Behaviour on the existing `Material` aggregate, not a new module.
- Leading/trailing whitespace is trimmed; whitespace-only is blank (stakeholder accepted).
- Synchronous, same transaction as today's register/edit (audit entry unchanged in shape).

## Risks

- Every place that creates materials (acceptance test data for BOMs, products, standard BOMs,
  dashboard) now has to supply a unique code — the main source of red guardrails.
- The DB unique constraint is the real guard against races; the handler pre-check gives the
  friendly 409, and a unique-violation on `code` must map to the same 409.
