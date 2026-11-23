# Create similar product / standard BOM — plan (issue #133)

Design: `docs/superpowers/specs/2026-11-23-create-similar-design.md`. Frontend + acceptance only;
no backend task. No new request/response fields: the copy is sent through the unchanged
`POST products` (`name`, `components: [{ componentId, materialIds }]` as today) and
`POST standard-boms` (same body as today's create).

## QA (acceptance-tests)

1. Automate the 7 new scenarios of each rule (see design) — UI door for every active `When`,
   API (as یاشار) for preconditions and facts, per the bom-registration row of the door table.
2. New tasks: open the source row's «⋮» menu and choose «تعریف محصول مشابه» /
   «تعریف آنالیز مشابه»; read the pre-filled create form (name + component/material rows in
   order; product, MI code, brand, standard length, active flag, description, weights);
   save with changed name / MI code / brand / removed component; cancel («انصراف»).
3. Product saves answer «خیر» to the issue #128 offer, as every browser product registration does.
4. «… بدون تغییر در سیستم ثبت شده باشد» for a product already exists (issue #128); make it
   compare with a snapshot noted before the action for these scenarios too. Add the standard-BOM
   equivalent. «پیغام خطای کد MI تکراری» and «پیغام خطای حداقل یک جز برای محصول» must read the
   form error after a similar-save (use or extend the existing dispatch contexts).
5. Update `acceptance-tests/CLAUDE.md`'s door table with an issue #133 row.

## Frontend

1. `ProductFormDialog`: accept a "prefill from product" input in create mode; fill name and the
   component rows in the source's order.
2. `ProductsPage`: row menu item «تعریف محصول مشابه» (visible to the same roles as «ثبت محصول جدید»),
   loads the product, opens the create dialog pre-filled; on save behaves exactly as create.
3. `StandardBomFormDialog`: accept "prefill from standard BOM" in create mode; fill product, MI
   code, brand, standard length, active flag, description, weights; no in-use locks.
4. `StandardBomsPage`: row menu item «تعریف آنالیز مشابه», same gating as the new button.
5. Specs for each; a11y spec covers the menus' new items if it opens them.
