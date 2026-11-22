# Offer a standard BOM right after registering a product — design (issue #128)

## Capability

Once a new product is registered, the products page offers to define its standard BOM (آنالیز
استاندارد) on the spot, instead of the user leaving for the standard-BOMs page and picking the
product again.

Scenarios (all in `acceptance-tests/specs/bom-registration/registring-product.feature`, rule
"پس از ثبت موفق محصول جدید، تعریف آنالیز استاندارد همان محصول به کاربر پیشنهاد می شود"), **all
UI-voiced** — the offer only exists in the browser:

1. پیشنهاد تعریف آنالیز استاندارد پس از ثبت محصول جدید
2. پذیرفتن پیشنهاد، فرم ثبت آنالیز استاندارد را با محصول تازه ثبت شده باز می کند
3. ثبت آنالیز استاندارد برای محصول تازه ثبت شده از پیشنهاد پس از ثبت
4. رد پیشنهاد تعریف آنالیز استاندارد
5. انصراف از فرم ثبت آنالیز استاندارد، محصول تازه ثبت شده را تغییر نمی دهد
6. ثبت ناموفق محصول، تعریف آنالیز استاندارد را پیشنهاد نمی دهد
7. ویرایش محصول، تعریف آنالیز استاندارد را پیشنهاد نمی دهد

No `cablan:gherkin-proposal` comment existed on the issue, so these scenarios were written from
the issue's acceptance criteria.

## Slice

- **Backend: nothing.** `POST /api/products` already answers 201 with the registered product
  (`id`, `name`, `components[].materials[]`), and `POST /api/standard-boms` is unchanged — the
  standard BOM's validation, permissions (Technical Manager / System Admin, the same roles that
  register products) and dependency rules all stay exactly as they are.
- **Frontend:**
  - `ProductsGateway.register` returns the registered `AppProduct` (mapped from the 201 body)
    instead of `void`; `ProductFormDialog` closes with that product in create mode (edit mode
    still closes with `true`).
  - `ProductsPage.openCreateDialog`, on a registered product, opens a small confirmation dialog:
    text «محصول با موفقیت ثبت شد. آیا می‌خواهید برای این محصول آنالیز استاندارد تعریف کنید؟»,
    buttons «بله، تعریف آنالیز استاندارد» and «خیر». Shown only when the user may manage standard
    BOMs (`canManageStandardBoms`) — today always true for anyone who could register a product.
  - «بله» opens the existing `StandardBomFormDialog` in create mode with the new product
    preselected and locked: a new optional `lockedProductId` on the create-mode data. The product
    renders the way edit mode already renders it (a plain «محصول: <name>» label, no picker), and the
    composition lines are pre-cloned from that product. Every other field and behaviour is
    unchanged.
  - «خیر», Escape, or cancelling the standard BOM form just close; the product is untouched.
  - A failed registration never closes the product dialog, so the offer never appears.
- **QA:** automate the seven scenarios through the browser; adjust the existing UI-driven product
  registration tasks to dismiss the offer («خیر») where they don't care about it.

## Decisions

- Pure frontend orchestration on the products page; no new endpoint, no new problem type.
- The standard-BOMs page's own create flow is untouched (no `lockedProductId` there).

## Risks

- Existing UI scenarios that register a product through the browser now meet an extra dialog;
  their tasks must dismiss it, or later steps will be blocked by the overlay.
