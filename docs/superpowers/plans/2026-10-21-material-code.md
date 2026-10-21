# Material code: required and unique — plan

Design: `docs/superpowers/specs/2026-10-21-material-code-design.md`. Issue #51.

## Contract (pinned)

- `RegisterMaterialDto { name: string; code: string }` — both required, non-blank after trim.
- `UpdateMaterialDto { name: string; code: string }` — both required, non-blank after trim
  (the "omit / null clears it" semantics are removed).
- Blank code → 400 `https://my-api-doc.dev/problems/validation-error`, `errors[]` entry with
  `field: "code"`.
- Duplicate code (register, or edit to another material's code) → 409
  `{ type: "https://my-api-doc.dev/problems/material-code-already-exists", title: "Material Code Already Exists", status: 409, detail: "A material already exists with code M-101", code: "M-101" }`.
- `GET /api/materials` read model unchanged in shape; `code` becomes non-nullable `string`.

## QA (`acceptance-tests/`)

1. Step definitions for the four new examples, reusing the name rules' vocabulary
   (code instead of name), on the same door as their name counterparts.
2. Every material test-data builder supplies a unique code by default.

## Backend (`backend/`)

1. Domain: `Material` requires a non-blank trimmed code on register and edit.
2. Application: `MaterialCodeAlreadyExists` exception; register/edit handlers check the
   repository for another material with that code (repository port gains a lookup by code).
3. Infrastructure: DTOs, Prisma `code String @unique` + migration, repository, exception mapper
   (incl. unique-violation on `code`), OpenAPI regenerated.

## Frontend (`frontend/`)

1. Materials list: code column before name.
2. Register/edit dialog: code before name; code required; 409 duplicate-code → Persian field error.
3. Product registration material picker: display name only; filter on name or code.
