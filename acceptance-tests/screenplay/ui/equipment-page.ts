import { By, PageElement } from '@serenity-js/web';
import { errorOfFieldLabelled } from './form-field';

const NAME_LABEL = 'نام تجهیز';

/**
 * Lean Page Object for `/equipment` («تجهیزات / دستگاه» under «اطلاعات پایه» — issue #69).
 * Locates elements and reports what they say — nothing else; the behaviour lives in
 * `screenplay/maintenance-management/equipment.ts`.
 *
 * Every locator is confirmed against the source (`frontend/src/app/features/equipment/`: the page,
 * its form dialog and its retire confirmation), not yet against a rendered page. The page follows
 * the other master-data pages: a list in a table, one dialog form for add and edit, a direct
 * «ویرایش {name}» row button and the other row actions in the row's «عملیات بیشتر برای {name}»
 * menu (`common/row-actions.ts`).
 */
export const EquipmentPage = {
  /** The page's `<h1>`, «مدیریت» + the menu label, as on the other master-data pages. */
  heading: () =>
    PageElement.located(
      By.role('heading', {
        name: 'مدیریت تجهیزات / دستگاه',
        level: 1,
        exact: true,
      }),
    ).describedAs('equipment page heading'),

  /** The button that opens the "new equipment" dialog. */
  addButton: () =>
    PageElement.located(
      By.role('button', { name: 'افزودن تجهیز', exact: true }),
    ).describedAs('add equipment button'),

  /** The one field of the add/edit dialog, a text input labelled «نام تجهیز». */
  nameField: () =>
    PageElement.located(
      By.role('textbox', { name: NAME_LABEL, exact: true }),
    ).describedAs('equipment name field'),

  /** The add/edit dialog's submit button. */
  submitButton: () =>
    PageElement.located(
      By.role('button', { name: 'ثبت تجهیز', exact: true }),
    ).describedAs('submit equipment button'),

  /**
   * Both name errors — blank (client-side `required`) and taken (409
   * `equipment-name-taken`, its Persian `detail`) — render as the name field's `<mat-error>`.
   * Anchored on `mat-form-field`/`mat-label`/`mat-error`, **not gated** by the accessibility check.
   */
  nameError: () => errorOfFieldLabelled(NAME_LABEL),

  /** Each equipment's name is a table cell of the list. */
  equipmentNamed: (name: string) =>
    PageElement.located(By.role('cell', { name, exact: true })).describedAs(
      `equipment named "${name}"`,
    ),

  /** The row's direct edit button, named for the equipment («ویرایش اکسترودر 1»). */
  editButton: (name: string) =>
    PageElement.located(
      By.role('button', { name: `ویرایش ${name}`, exact: true }),
    ).describedAs(`edit button for "${name}"`),

  /**
   * Retiring is an item of the row's actions menu («عملیات بیشتر برای {name}»),
   * labelled «کنار گذاشتن».
   */
  retireMenuItem: () =>
    PageElement.located(
      By.role('menuitem', { name: 'کنار گذاشتن', exact: true }),
    ).describedAs('retire menu item'),

  /** The confirmation dialog's confirm button. */
  confirmRetirementButton: () =>
    PageElement.located(
      By.role('button', { name: 'کنار گذاشتن تجهیز', exact: true }),
    ).describedAs('confirm retirement button'),
};
