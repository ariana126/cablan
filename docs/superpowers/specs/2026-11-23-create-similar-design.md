# Create similar product / standard BOM — design (issue #133)

## Capability

A user allowed to register a product or a standard BOM can start a new one from an existing
record: a row action «تعریف محصول مشابه» / «تعریف آنالیز مشابه» opens the **create** dialog
pre-filled with the source's data. Saving registers an independent new record through the
ordinary create endpoint; the source is never touched. Cancelling registers nothing.

## Scenarios (all UI-voiced for their `When`s)

`registring-product.feature`, rule «تعریف محصول مشابه …»:
- فرم تعریف محصول مشابه با اطلاعات محصول مبنا باز می شود
- ثبت محصول مشابه با نام جدید
- ثبت محصول مشابه با تغییر اجزا
- تعریف محصول مشابه از محصولی که آنالیز استاندارد دارد
- ثبت محصول مشابه بدون هیچ جزئی
- انصراف از تعریف محصول مشابه
- تعریف محصول مشابه توسط مدیر کارخانه

`registring-standard-bom.feature`, rule «تعریف آنالیز مشابه …»:
- فرم تعریف آنالیز مشابه با اطلاعات آنالیز مبنا باز می شود
- ثبت آنالیز مشابه با کد MI جدید
- ثبت آنالیز مشابه با تغییر برند
- آنالیز مشابه با کد MI تکراری ثبت نمی شود
- تعریف آنالیز مشابه از آنالیز استانداردی که آنالیز روزانه دارد
- انصراف از تعریف آنالیز مشابه
- تعریف آنالیز مشابه توسط مدیر کارخانه

No stakeholder Gherkin proposal existed on the issue; these scenarios were written from the
issue's acceptance criteria.

## Slice

**Frontend-only.** Every rule the issue names already lives on the create endpoints
(`POST products`, `POST standard-boms`): validation, at least one component / material, MI-code
uniqueness (409 `standard-bom-mi-code-taken`), and the role check (403). A "similar" record is a
plain create, so the backend gains nothing — no endpoint, no command, no problem type. The
dependency rule (issue #94) is unaffected: reading a record in use is allowed, and the copy
references what the source references (a product's components and materials, a standard BOM's
product), which is an ordinary new reference.

Product names are not unique, so a copy saved with the source's name is accepted (matching
today's create rules).

**UI.**
- `/products`: the row's «⋮» menu gains «تعریف محصول مشابه» (accessible name
  «تعریف محصول مشابه <name>» if the menu items are named per row, otherwise the plain text; the
  menu trigger is already per row). It opens `ProductFormDialog` in **create** mode, titled as
  the create form («ثبت محصول جدید»), with the name and every component row (component, its
  materials, in the product's order) filled from the source. Save calls create; the
  post-registration standard-BOM offer (issue #128) follows as for any new product.
- `/standard-boms`: the row menu gains «تعریف آنالیز مشابه». It opens `StandardBomFormDialog` in
  **create** mode («ثبت آنالیز استاندارد جدید») with product, MI code, brand, standard length,
  active flag, description and every standard weight filled from the source. The product stays
  selectable as in a normal create. Save calls create, so a kept MI code gets the existing
  duplicate-MI field error.
- Both items show only to roles that see the page's «new» button (same gate).
- The source record is loaded with the same read the edit action uses.

## Decisions

- No backend change, no new endpoint — the copy is assembled client side from the existing read.
- The dialogs gain a "create pre-filled from" input rather than a new dialog.
- Nothing locks in the copy (unlike the edit of an in-use record): it is a new record.

## Risks

- The dialogs' edit mode carries in-use locks and the System Admin correction confirmation; the
  pre-filled create must take none of that path.
- Acceptance locators for the new menu items are assumptions until the frontend lands.
