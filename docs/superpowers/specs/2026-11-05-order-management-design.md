# Order management and MI assignment — design (issue #101)

## Capability

An order («سفارش») becomes a record of its own: a unique order number with one or more MI codes
(standard BOMs) assigned to it. A daily BOM can only be registered for a defined order, with one
of that order's MI codes; legacy order numbers are carried over from the daily BOMs already
registered, each MI code they were used with assigned to them.

Approved Gherkin (issue #101's `cablan:gherkin-proposal`, approved 2026-11-05):

- **New** `acceptance-tests/specs/planning/registring-order.feature` — «تعریف سفارش و تخصیص کد MI»:
  define with one / several MI codes; who may define, add an MI code, delete (Management and
  System Admin only); empty order number; no MI code; duplicate number (Persian digits too);
  duplicate MI code in an order; unknown MI code; MI codes of two products; adding an MI code to an
  order with daily BOMs (Management and System Admin) leaves those daily BOMs untouched; an order
  with daily BOMs can be neither deleted, renumbered, nor lose an MI code (System Admin can't remove
  a used MI code either); an order without daily BOMs can be edited and deleted; the System Admin's
  order-number correction confirmed with «اعمال در اطلاعات و سوابق مرتبط» (and not without it, and
  not onto a taken number); the System Admin's delete of an order together with its daily BOMs; the
  legacy carry-over.
- **Changed** `bom-registration/registring-bom.feature` — Background now defines `ORD-5001` with
  MI `0001`; new rules: registration only for a defined order with one of its MI codes (auto-select
  of a single code, a choice required among several, outside code, undefined order, Persian-digit
  order number); on edit, the MI code changes only to another code of the same product assigned to
  the order (an approved daily BOM returns to pending), and the order number changes only to a
  defined order holding the daily BOM's MI code.
- **Changed** `bom-registration/registring-standard-bom.feature` — a standard BOM whose MI code is
  assigned to an order can be neither deleted nor edited, even with no daily BOM on it.

UI-voiced: whatever the acceptance suite's door rules make of the active `When`s (QA decides per
`acceptance-tests/CLAUDE.md`); the UI is built in full regardless — the issue asks for a
«برنامه‌ریزی» menu with a «سفارشات» page, and the daily-BOM form must drive the order → MI choice.

## Decisions

**Order is a new aggregate in the `boms` module, not a new module.** Everything the order rules
touch is daily-BOM data: the in-use check counts daily BOMs, the System Admin's renumbering rewrites
their `order_number`, his delete removes them, and registration/edit validate against the order.
Inside one module those are plain same-transaction repository calls; a separate `planning` module
would need two new cross-module query carve-outs plus a cross-module cascade-delete mechanism that
the framework does not have. The «برنامه‌ریزی» menu is a frontend grouping only.

- `Order` aggregate (`domain/order.aggregate.ts`): `id`, `orderNumber` (the existing
  `OrderNumber` VO — required, `toAsciiDigits`), `miCodes: OrderMiCode[]` (each `standardBomId`,
  `miCode`, `productId`, `productName` snapshot), invariants: ≥ 1 MI code, no MI code twice.
  Methods `define`, `addMiCode`, `edit(orderNumber, miCodes)`, `delete`. Events `OrderDefined`,
  `OrderMiCodeAdded`, `OrderEdited`, `OrderDeleted`, projected by `audit-logging` like every other
  aggregate.
- Tables `bom_order` and `bom_order_mi_code` (unique `order_number`; unique
  `(order_id, standard_bom_id)`). Daily BOMs keep their `order_number` string as the link (it is
  unique on the order), no foreign key — the snapshot convention (ADR 0004).
- MI codes are resolved through the existing `GetManufacturingInstructionByMiCodeQuery`; a new
  service file needs its own `*-reuse-is-narrow` carve-out pair (or the existing factory is reused —
  backend's call). Unknown MI code → 400 `order-mi-code-not-found`.

**Dependency policy (issue #94/#110).**
- New `ReferencedRecordType` `order`; `PrismaBomsDependentsProbe` answers it with the daily BOMs
  whose `order_number` equals the order's (kind `daily-bom`, named by order number). Edit and
  delete of an order call the guard; adding an MI code does **not** (the Gherkin allows it).
- New `DEPENDENT_KINDS` entry `order`: the boms probe answers `standard-bom` references with the
  orders assigning it (kind `order`, named by order number) — the standard BOM's existing guarded
  edit/delete handlers then refuse with 409, «… در 1 سفارش "ORD-5001" …».
- **System Admin exceptions (approved):** (1) correcting the order number of an order in use, with
  `applyToRelatedRecords` — through `RecordDependencies.editRecordInUse()` with
  `CorrectableFields { name: orderNumber }`, carried into every daily BOM's `order_number` by a
  `CorrectionPropagator` for `order` (no edit history, review state untouched); an edit that also
  changes MI codes is not a correction and gets the 409; a taken number is 409 `order-number-taken`.
  (2) deleting an order in use deletes it with all its daily BOMs (re-samples included) in one
  transaction, each daily BOM's `BomDeleted` event raised. Management gets the 409 for both.

**Daily BOM registration and edit.**
- `RegisterBomDto.standardBomMiCode` becomes optional. The handler loads the order by number
  (normalised): none → 400 `bom-order-not-defined`; MI code omitted with one code on the order → that
  code; omitted with several → 400 `bom-mi-code-required`; given but not on the order → 400
  `bom-mi-code-not-in-order`.
- Edit: a changed `orderNumber` must name a defined order (`bom-order-not-defined`) holding the
  daily BOM's (new) MI code (`bom-mi-code-not-in-order`). A changed `standardBomMiCode` must be on
  the order **and** of the same product as the current one (else `bom-mi-code-not-in-order`); it
  reclones the composition from the new standard BOM (so `components` is required with it) and
  **re-points** `standardBomId`, `standardBomMiCode`, `brand`, `productName`, `standardLength` — a
  real change, in the edit history as an `standardBomMiCode` change line, returning an approved
  daily BOM to pending under the existing rules.
- Re-sampling keeps the source's order and MI code (no change needed; orders can never lose a used
  MI code).

**Legacy carry-over.** The migration creating the tables inserts one order per distinct
`bom.order_number` and one assignment per distinct `(order_number, standard_bom_id)`, touching no
`bom` row. The same idempotent backfill is reachable on the test stack only, with a way to register
"legacy" daily BOMs that bypass the order rule: `POST /api/testing/boms/legacy-daily-boms` (body as
`POST /boms`, MI code required) and `POST /api/testing/boms/order-backfill` — mounted like
`MaintenanceTestingModule`.

**Reads.** All four production roles read orders (`PRODUCTION_ROLES`); writes are Management and
System Admin. `GET /orders/by-number/:orderNumber` serves the daily-BOM form.

## UI

- Main menu: new category «برنامه‌ریزی» → «سفارشات» (`/orders`), for the production roles. No home
  shortcut (role-based-home-page compares shortcuts exactly).
- `/orders` page («سفارشات»): table «شماره سفارش» / «کدهای MI» (each code with its product); for
  Management/System Admin a «تعریف سفارش» button and per-row «افزودن کد MI», «ویرایش», «حذف».
  Form dialog: «شماره سفارش» + «کدهای MI» (multi-select of the standard BOMs). Refusals shown in the
  dialog through `recordHasDependentsMessage()`; the System Admin's renumbering of an order in use
  goes through the existing correction confirmation dialog.
- Daily-BOM form: «شماره سفارش» looked up as typed; «کد MI» offers only the order's codes,
  preselected when there is one; an undefined order is reported in the form. In edit, «کد MI» offers
  the order's codes of the same product; changing it reloads the composition, keeping weights for
  matching component/material pairs.

## Risks

- Every acceptance precondition that registers a daily BOM now needs its order defined first — the
  suite-wide fix lives in QA's shared fixtures (define-or-extend the order idempotently, as یاشار).
- Problem types and field names below are pinned for QA and backend working in parallel.
