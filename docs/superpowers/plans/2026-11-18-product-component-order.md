# Product component order — plan (issue #122)

Design: `docs/superpowers/specs/2026-11-18-product-component-order-design.md`.

## QA (acceptance-tests)
1. Automate the eight new scenarios (registring-product.feature's outline under the access rule and
   its four new rules; viewing-audit-log.feature's last rule). Reuse existing product / standard BOM
   / daily BOM preconditions.
2. «محصول "X" با ترتیب اجزای "A، B، C" در سیستم ثبت شده باشد» and the «"A" از مواد اولیه "M"، …»
   form: API precondition, registering missing components/materials.
3. Reorder (UI): the product's edit dialog, click «انتقال <name> به بالا/پایین» until the rows read
   the target order, save. Unauthorised attempt: `PATCH /products/:id` with the reordered
   `components` → 403.
4. Combined attempt: UI edit dialog, reorder + add «زره», save → dialog alert (issue #94).
5. Facts over the API as یاشار: the product's components in order, the standard BOM's and daily
   BOM's components in order, the audit change line `componentOrder` (values joined «، »).

## Backend
1. Migration: `position` on `product_component` and `product_material`; repository writes and
   reads by it.
2. `Product`: reorder detection, `ProductComponentsReordered` event.
3. `EditProductHandler`: the lock's exemption for reorder-only edits (and ride-along with a System
   Admin correction).
4. Framework `CompositionOrderPropagator` port + discovery; implementations in
   manufacturing-instructions and boms; invoked in the edit's unit of work.
5. audit-logging: project the event as a Product edit with change `componentOrder`.
6. Regenerate OpenAPI if anything changed.

## Frontend
1. Product register/edit dialogs: «انتقال <name> به بالا» / «انتقال <name> به پایین» per component
   row; the submitted `components` follow the on-screen order.
2. Editing stays possible for products in use (the order can change); refusals via
   `recordHasDependentsMessage()`.
3. Audit details label `componentOrder` → «ترتیب اجزا».
4. Product, standard BOM and daily BOM views render components in the order the API returns.
