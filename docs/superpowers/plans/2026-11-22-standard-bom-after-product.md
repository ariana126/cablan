# Plan — offer a standard BOM after registering a product (issue #128)

Design: `docs/superpowers/specs/2026-11-22-standard-bom-after-product-design.md`. API-free: no
backend task.

## Frontend (`frontend-engineer`)

1. `ProductsGateway.register(dto): Observable<AppProduct>` — map the 201 body with `toAppProduct`.
2. `ProductFormDialog`: create mode closes with the registered `AppProduct`; edit mode unchanged.
3. New dialog `features/products/offer-standard-bom-dialog.ts` (Material dialog, OnPush):
   - accessible content text exactly
     `محصول با موفقیت ثبت شد. آیا می‌خواهید برای این محصول آنالیز استاندارد تعریف کنید؟`
     (it may also be the dialog's heading / `aria-labelledby` target);
   - `<button type="button">` «بله، تعریف آنالیز استاندارد» → closes with `true`;
   - `<button type="button">` «خیر» → closes with `false`.
4. `StandardBomFormDialogData` create variant gains optional `lockedProductId?: string`. When set:
   the form starts with that `productId` and the components cloned from that product; the product
   renders as the edit-mode label `<p class="product-name"><strong>محصول:</strong> NAME</p>`, no
   `app-searchable-select`. Heading stays «ثبت آنالیز استاندارد جدید».
5. `ProductsPage.openCreateDialog`: on a registered product → reload the list, and if
   `canManageStandardBoms(role)` open the offer; on `true` open `StandardBomFormDialog` with
   `{ mode: 'create', products: [registeredProduct], lockedProductId: registeredProduct.id }`.
6. Specs for all of the above; register the offer dialog (and the locked form) in
   `a11y/accessibility.spec.ts` if the audit pattern covers dialogs.

## QA (`qa-engineer`)

Automate the seven scenarios of the new rule in `registring-product.feature` through the browser
(products page → «محصول جدید» form → submit). Locators: the offer by its text and its two buttons
by name; the standard BOM form by its heading «ثبت آنالیز استاندارد جدید»; the locked product by the
text «محصول:» + name and by the absence of a «محصول» combobox; its cancel button as the existing
standard BOM form page object finds it. Assertions on stored state go over HTTP
(`GET /api/products`, `GET /api/standard-boms`). Update every existing UI task that registers a
product through the browser to answer «خیر» to the offer.
