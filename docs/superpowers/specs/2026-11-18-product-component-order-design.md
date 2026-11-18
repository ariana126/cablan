# Product component order — design (issue #122)

## Capability

Management (مصطفی) and the System Admin (یاشار) set the order of a product's components, at
registration and afterwards; each component moves with its own materials; the order is per product,
persisted, allowed even when the product has standard BOMs (only the order — every other change of
a locked composition is still refused), recorded in the audit log, and every standard and daily BOM
of the product shows its components in the product's current order.

Scenarios (`acceptance-tests/specs/bom-registration/registring-product.feature`, plus one in
`audit-logging/viewing-audit-log.feature`):

| Scenario | Voice |
|---|---|
| ترتیب پیش فرض اجزای محصول تازه | **UI** (active registration) |
| تغییر ترتیب اجزای محصول (مصطفی, یاشار) | **UI** (active reorder) |
| تغییر ترتیب یک محصول ترتیب محصول دیگر را تغییر نمی دهد | **UI** |
| تلاش کاربر بدون دسترسی برای تغییر ترتیب اجزای محصول | API (access-denied attempt, 403) |
| تغییر ترتیب اجزای محصولی که آنالیز استاندارد دارد | **UI** |
| ویرایشی که هم ترتیب را عوض می کند و هم جز تازه اضافه می کند | UI attempt (issue #94 convention for this area), 409 shown in the dialog |
| آنالیزهای قبلی محصول ترتیب جدید را نشان می دهند | UI `When`; facts over the API |
| ثبت رویداد تغییر ترتیب اجزای محصول (audit) | API |

## Vertical slice and decisions

- **No new endpoint.** The order of `components` in `POST /products` and `PATCH /products/:id`
  *is* the order. Every product read returns components — and each component's materials — in
  stored order.
- **Persistence:** `position Int @default(0)` on `product_component` and on `product_material`
  (Prisma migration, backfilling existing rows in their current physical/insertion order per
  parent). Every read orders by `position`.
- **Domain (`Product`):** `updateComponents(lines)` tells a *reordering* (the same lines — same
  component id with the same material ids — as a permutation, order changed) from any other
  composition change. A reordering records a new event `ProductComponentsReordered(productId,
  previousOrder: string[] (component names), newOrder: string[], componentIds: string[] in the new
  order)` instead of `ProductComponentsUpdated`. An identical composition records nothing.
- **The issue #94 lock gets one exemption:** an edit whose name is unchanged and whose composition
  is a reordering of the current one skips the dependents check — for Management and System Admin
  alike (it is a rule, not a System Admin exception). Combined with a System Admin name correction
  (`applyToRelatedRecords`) the reorder rides along with the correction. Anything else on a
  product in use (adding a component such as «زره», or a name change by Management) is the 409
  `record-has-dependents`, and nothing — order included — changes.
- **Propagation to snapshots (synchronous, same unit of work):** a new framework port
  `CompositionOrderPropagator`, beside `CorrectionPropagator` and discovered the same way:
  `propagate(reference: { recordType: 'Product', id }, orderedComponentIds: string[])`.
  `manufacturing-instructions` rewrites the component positions of every standard BOM of that
  product; `boms` rewrites the component positions of every daily BOM of those standard BOMs.
  Matched by `componentId`; a snapshot line whose component is not in the list keeps its relative
  order after the matched ones. Directly on the transaction: no domain events, no audit entries, no
  change to weights, approval status or edit history.
- **Audit:** audit-logging projects `ProductComponentsReordered` as an edit entry of the Product
  with one change line, key `componentOrder`, previous/new values the component names joined with
  «، » (e.g. `هادی، عایق، روکش`). The frontend's audit details label it «ترتیب اجزا».
- **UI:** the product register and edit dialogs give each component row two buttons,
  «انتقال <name> به بالا» / «انتقال <name> به پایین» (first/last disabled); the materials stay in
  their row. The controls stay usable on a product in use; a refusal shows through
  `recordHasDependentsMessage()` in the open dialog as today.

## Risks

- The backfill of existing products' order is best effort (insertion/physical order), since no
  order was ever stored.
- The propagator matches by component id; a snapshot whose components drifted from the product
  keeps the unmatched lines at the end rather than failing.
