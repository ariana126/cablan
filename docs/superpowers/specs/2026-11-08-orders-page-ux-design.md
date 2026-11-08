# Orders page UX and usability — design (issue #111)

## Capability

The «سفارشات» page (`/orders`, issue #101) becomes easier to scan and search: a compact list with
live search and filters, an in-page details panel that holds the order's actions, a searchable MI
code picker, and actions that already reflect the user's role and the order's dependencies. **No
business rule changes** — the API and every rule of `planning/registring-order.feature` stay as
they are.

The issue has no `cablan:gherkin-proposal` comment, so no feature file changes. The existing
scenarios keep running, and their UI-voiced `When`s (define, define with several MI codes, empty
order number, add an MI code, edit, delete, the System Admin's renumbering and delete) must keep
passing through the new markup. Every «تلاش …» stays on the HTTP door, so disabling an action in the
UI removes no automated path.

## Slice

- **Backend: nothing.** `GET /orders` already returns `id`, `orderNumber`,
  `miCodes[{ standardBomId, miCode, productId, productName }]` and `dailyBomCount` for every order.
  Search and filtering are client-side over that list, which the page already loads in full.
- **Frontend:** the page, its dialogs and their specs.
- **Acceptance tests:** the Lean Page Object `ui/orders-page.ts` and the planning tasks that drive
  it follow the new markup: select an order, then act in its details panel, and type into the
  MI-code autocompletes. No step wording changes.

## Decisions

**List.** The columns are «شماره سفارش» (`orderNumber`; the cell's text is exactly the order number,
inside a button named «جزئیات سفارش <n>»), «محصول» (`products`; every distinct product name of the
order, so an order with two products never reads as one), «تعداد کد MI» (`miCodeCount`) and
«آنالیز روزانه» (`dailyBomCount`). Rows have no action buttons. Clicking a row, or its button,
selects it.

**Search and filters** sit above the table and combine with AND:

- a search box «جست‌وجوی سفارش» that matches the order number, an MI code or a product name as a
  case-insensitive substring, with Persian and Arabic-Indic digits folded to ASCII on both sides;
- «محصول»: every product in the list, defaulting to «همه محصولات»;
- «آنالیز روزانه»: «همه» / «دارای آنالیز روزانه» / «بدون آنالیز روزانه».

One button, «پاک کردن جست‌وجو و فیلترها», resets all three. The no-match empty state says so and
offers the same reset.

**Details panel.** It opens on the same page: beside the list on wide viewports, stacked below it on
narrow ones. It is a `region` headed «جزئیات سفارش <n>» (h2) and shows every MI code with its
product and the daily-BOM count. For Management and the System Admin it also holds the actions
«افزودن کد MI», «ویرایش» and «حذف», with «حذف» set apart as the dangerous one. A «بستن جزئیات» button
closes the panel. After any change the list reloads and the panel shows the reloaded order, matched
by id: a renamed order stays selected, and a deleted one closes the panel.

**Permissions and dependency state, before the attempt.**

- Read-only roles see the list and the details, with no define, add, edit or delete controls.
- Management, on an order with daily BOMs: «ویرایش» and «حذف» are disabled, with a visible reason
  («این سفارش در N آنالیز روزانه ثبت شده است؛ ویرایش و حذف آن ممکن نیست. افزودن کد MI همچنان ممکن
  است.»). «افزودن کد MI» stays enabled.
- System Admin, on an order with daily BOMs: «ویرایش» is enabled, but the form locks the MI codes,
  so only the number can be corrected, and the existing correction confirmation follows. «حذف» is
  enabled, and its confirmation states the exact number of daily BOMs deleted with the order.

**MI code pickers.**

- Define and edit: «کدهای MI» is a Material chip grid with an autocomplete (role `combobox`). It
  filters by MI code or product name and never offers a code that is already selected. Each chosen
  code is a removable chip («برداشتن <code>»).
- The add-MI dialog shows the order number and its assigned codes. Its «کد MI» autocomplete offers
  only codes not yet assigned.

Duplicate order numbers and other refusals are shown in the dialog, as they are today.

**Delete confirmation.** It names the order and says the deletion can't be undone. For the System
Admin deleting an order in use, it adds «N آنالیز روزانه همراه آن حذف می‌شود». The button still
reads «حذف».

## Risks

- QA's page object is coupled to the row buttons and the `mat-select`s, so it changes in the same
  commit.
- The two-pane layout must reflow on phones and pass the a11y audit in both colour schemes.
