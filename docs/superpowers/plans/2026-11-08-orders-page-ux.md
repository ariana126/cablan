# Orders page UX — plan (issue #111)

Design: `docs/superpowers/specs/2026-11-08-orders-page-ux-design.md`. The API is unchanged; there
is no backend task.

## Frontend (`frontend/src/app/features/orders/`)

1. Pure helpers, each with a spec: a digit-folding search matcher (order number, MI code, product
   name), a filter predicate (product id, whether the order has daily BOMs), and the distinct
   products of an order.
2. `orders-page.ts`: the search box «جست‌وجوی سفارش», the selects «محصول» and «آنالیز روزانه», and
   the reset «پاک کردن جست‌وجو و فیلترها»; the columns `orderNumber` / `products` / `miCodeCount` /
   `dailyBomCount`; row selection; a no-match empty state with the reset.
3. Details panel component: the region «جزئیات سفارش <n>», the MI codes with their products, the
   daily-BOM count, and the actions «افزودن کد MI», «ویرایش», «حذف» and «بستن جزئیات». Each action
   is enabled according to the role and the order's dependencies, with the visible reason when it
   is not.
4. `order-form-dialog.ts`: the chip-grid autocomplete «کدهای MI» — searchable, no duplicates,
   removable chips «برداشتن <code>»; the MI codes are locked for an order in use.
5. `add-order-mi-code-dialog.ts`: shows the order number and its assigned codes; the autocomplete
   «کد MI» offers unassigned codes only.
6. `confirm-delete-order-dialog.ts`: the order number, that the deletion is irreversible, and the
   exact daily-BOM count.
7. A responsive layout that uses design-system tokens only, and the a11y route pass.

## QA (`acceptance-tests/screenplay/`)

1. `ui/orders-page.ts`: the details button, the details region and its buttons; the autocomplete
   comboboxes and chip removal.
2. `planning/orders-form.ts` and its callers: open the order's details, then click the action there;
   pick an MI code by typing it, then clicking the option.
3. Update the orders row of `acceptance-tests/CLAUDE.md`.
