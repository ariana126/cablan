import { By, PageElement } from '@serenity-js/web';

/**
 * The define/edit dialog — a `mat-dialog`, `role="dialog"`; only one is open at a time, and while
 * it is the page behind it is hidden from role locators anyway.
 */
const openDialog = () =>
  PageElement.located(By.role('dialog')).describedAs('QC activity dialog');

/**
 * Lean Page Object for `/qc-activities` («فعالیت‌های QC» under «اطلاعات پایه» — issue #119).
 * Locates elements and reports what they say — nothing else; the behaviour lives in
 * `screenplay/quality-control/qc-activity.ts`.
 *
 * Confirmed against the source (`frontend/src/app/features/qc-activities/`: the page and its form
 * dialog): a list with a «تعریف فعالیت QC» button, row buttons «ویرایش {name}» / «حذف {name}», and
 * one dialog for define and edit whose only field is «عنوان فعالیت» (submit «ثبت» when defining,
 * «ذخیره تغییرات» when editing — enabled whatever the field holds).
 */
export const QcActivitiesPage = {
  /** The page's `<h1>` is the menu label, written with a ZWNJ. */
  heading: () =>
    PageElement.located(
      By.role('heading', { name: 'فعالیت‌های QC', level: 1, exact: true }),
    ).describedAs('QC activities page heading'),

  /** The button that opens the define dialog. */
  addButton: () =>
    PageElement.located(
      By.role('button', { name: 'تعریف فعالیت QC', exact: true }),
    ).describedAs('define QC activity button'),

  /** The dialog's one field, a text input labelled «عنوان فعالیت». */
  nameField: () =>
    PageElement.located(
      By.role('textbox', { name: 'عنوان فعالیت', exact: true }),
    )
      .of(openDialog())
      .describedAs('QC activity name field'),

  /** The define dialog's submit button. */
  registerButton: () =>
    PageElement.located(By.role('button', { name: 'ثبت', exact: true }))
      .of(openDialog())
      .describedAs('define QC activity submit button'),

  /**
   * A blank title keeps the dialog open and shows the field's `<mat-error>`, the only one the
   * dialog has. Structural anchor, **not gated** by the accessibility check.
   */
  nameError: () =>
    PageElement.located(By.css('mat-error'))
      .of(openDialog())
      .describedAs('QC activity name error message'),

  /** The open dialog itself — present while the visitor is still filling it in. */
  dialog: openDialog,
};
