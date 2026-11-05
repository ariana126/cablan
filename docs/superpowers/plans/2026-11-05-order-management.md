# Order management and MI assignment — plan (issue #101)

Design: `docs/superpowers/specs/2026-11-05-order-management-design.md`.

## HTTP contract (pinned)

All under `/api`. Roles: reads `PRODUCTION_ROLES`; writes `Management`, `SystemAdmin` (others 403).

| Route | Body | Success | Errors |
|---|---|---|---|
| `GET /orders` | — | 200 `{ items: OrderReadModel[] }` sorted by `orderNumber` | |
| `GET /orders/:id` | — | 200 `OrderReadModel` | 404 `entity-not-found` |
| `GET /orders/by-number/:orderNumber` | — (digits normalised) | 200 `OrderReadModel` | 404 `entity-not-found` |
| `POST /orders` | `{ orderNumber: string, miCodes: string[] }` | 201 `{ id }` | 400 `validation-error` (empty `orderNumber`; `miCodes` missing/empty → field `miCodes`); 409 `order-number-taken`; 400 `order-mi-code-not-found`; 409 `order-mi-code-already-assigned` (a code twice in the body) |
| `POST /orders/:id/mi-codes` | `{ miCode: string }` | 204 | 404; 400 `order-mi-code-not-found`; 409 `order-mi-code-already-assigned` |
| `PATCH /orders/:id` | `{ orderNumber?: string, miCodes?: string[], applyToRelatedRecords?: boolean }` (`miCodes` replaces the list, ≥ 1) | 204 | 404; 409 `record-has-dependents` (`recordType: 'order'`, `dependents: [{ kind: 'daily-bom', count, names }]`); 409 `order-number-taken`; 400 `order-mi-code-not-found`; 409 `order-mi-code-already-assigned` |
| `DELETE /orders/:id` | — | 204 (System Admin: also deletes its daily BOMs) | 404; 409 `record-has-dependents` (non-admin, order in use) |

`OrderReadModel` = `{ id: string, orderNumber: string, miCodes: { standardBomId: string, miCode: string, productId: string, productName: string }[], dailyBomCount: number }` — `miCodes` in assignment order.

Daily BOMs (`POST /boms`, `PATCH /boms/:id`):
- `RegisterBomDto.standardBomMiCode` optional. 400 `bom-order-not-defined` (no order with that
  number), 400 `bom-mi-code-required` (omitted, order has several), 400 `bom-mi-code-not-in-order`.
- `PATCH /boms/:id`: `standardBomMiCode` differing from the stored one changes the MI code
  (`components` required with it, cloned from the new standard BOM); must be on the order and of the
  same product → else 400 `bom-mi-code-not-in-order`. A changed `orderNumber` → 400
  `bom-order-not-defined` / `bom-mi-code-not-in-order`. Change line field `standardBomMiCode`.
- Standard BOM edit/delete: 409 `record-has-dependents` with kind `order`, names = order numbers.

Testing-only (`NODE_ENV=test`): `POST /api/testing/boms/legacy-daily-boms` (body = `RegisterBomDto`
with `standardBomMiCode` required; registers as the caller-less "legacy" path bypassing the order
rule, 201 `{ id }`; needs a bearer token if `registeredBy` requires one — backend documents it),
`POST /api/testing/boms/order-backfill` (204; idempotent carry-over, same SQL as the migration).

## Tasks

**QA** — automate the new feature file and the new rules in registring-bom / registring-standard-bom;
make every existing daily-BOM precondition define (or extend) the order it uses, idempotently, as
یاشار over the API; UI registration tasks must type a defined order number; the legacy scenario uses
the two testing endpoints; add `planning` to the door table and architecture tree.

**Backend** — `Order` aggregate + VOs + events in `boms`; commands `DefineOrder`, `AddOrderMiCode`,
`EditOrder`, `DeleteOrder`; queries `ListOrders`, `GetOrder`, `GetOrderByNumber`; register/edit
daily-BOM rules; `order` record type, probe answers (`order` ← daily BOMs, `standard-bom` ← orders),
correction propagator; System Admin cascade delete; migration with backfill; testing endpoints;
audit-logging projection of the order events; unit + integration specs; regenerated OpenAPI.

**Frontend** — «برنامه‌ریزی» → «سفارشات» menu + `/orders` page and dialogs; daily-BOM form's
order lookup and restricted «کد MI»; edit form's same-product restriction and composition reload;
Persian messages for the new problem types; audit-log labels for the order events; a11y route.
