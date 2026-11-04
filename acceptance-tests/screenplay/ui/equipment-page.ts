import { By, PageElement } from '@serenity-js/web';
import { errorOfFieldLabelled } from './form-field';
import { JalaliDateTimeField } from './jalali-datetime-field';

const NAME_LABEL = 'نام تجهیز';
const REACTIVATE = 'فعال سازی دوباره';
const NEW_FIRST_DUE_DATE = 'اولین موعد تازه';

/**
 * Issue #110, confirmed against source (`frontend/src/app/features/equipment/`): the confirmation
 * («حذف تجهیز») and reactivation («فعال سازی دوباره تجهیز») dialogs a
 * retired equipment's row opens are `mat-dialog`s (role `dialog`); while one is open the page
 * behind it is hidden from role locators, so a button in it can share its name with the row
 * menu's item without ambiguity. Scoped to it all the same.
 */
const openDialog = () =>
  PageElement.located(By.role('dialog')).describedAs('the open dialog');

/**
 * Confirmed against source (issue #110): the reactivation dialog lists each **active** plan row of the
 * equipment as a `radiogroup` named by the row's activity, holding two radios — «ادامه برنامه
 * قبلی» (continue the previous calendar; the default) and «تعیین اولین موعد تازه» (set a new first
 * due date) — and, for the latter, the shared Jalali date control labelled «اولین موعد تازه
 * {activity}» (a label per row, as the accessibility gate needs unique names).
 */
const reactivationRow = (activityName: string) =>
  PageElement.located(
    By.role('radiogroup', { name: activityName, exact: true }),
  )
    .of(openDialog())
    .describedAs(`reactivation choice for "${activityName}"`);

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

  /**
   * Confirmed against source (issue #110): on a **retired** equipment's row, for the System Admin, the actions
   * menu also offers «حذف تجهیز» and «فعال سازی دوباره» (`menuitem`s).
   */
  deleteMenuItem: () =>
    PageElement.located(
      By.role('menuitem', { name: 'حذف تجهیز', exact: true }),
    ).describedAs('delete equipment menu item'),

  reactivateMenuItem: () =>
    PageElement.located(
      By.role('menuitem', { name: REACTIVATE, exact: true }),
    ).describedAs('reactivate equipment menu item'),

  /**
   * Confirmed against source (issue #110): the deletion confirmation (listing the plan rows and executions that
   * go) confirms with «حذف تجهیز».
   */
  confirmDeletionButton: () =>
    PageElement.located(By.role('button', { name: 'حذف تجهیز', exact: true }))
      .of(openDialog())
      .describedAs('confirm equipment deletion button'),

  /** Confirmed against source (issue #110): the reactivation dialog's submit button, «فعال سازی دوباره». */
  confirmReactivationButton: () =>
    PageElement.located(By.role('button', { name: REACTIVATE, exact: true }))
      .of(openDialog())
      .describedAs('confirm reactivation button'),

  /** Confirmed against source (issue #110): one plan row's «ادامه برنامه قبلی» radio in the reactivation dialog. */
  continueThePreviousCalendarOption: (activityName: string) =>
    PageElement.located(
      By.role('radio', { name: 'ادامه برنامه قبلی', exact: true }),
    )
      .of(reactivationRow(activityName))
      .describedAs(`continue the previous calendar of "${activityName}"`),

  /** Confirmed against source (issue #110): one plan row's «تعیین اولین موعد تازه» radio. */
  setANewFirstDueDateOption: (activityName: string) =>
    PageElement.located(
      By.role('radio', { name: 'تعیین اولین موعد تازه', exact: true }),
    )
      .of(reactivationRow(activityName))
      .describedAs(`set a new first due date for "${activityName}"`),

  /** Confirmed against source (issue #110): one row's new first due date — a date-only Jalali
   * control (no time field; `timeLabel` is never looked for by `PickJalaliDateTime.dateOf`). */
  newFirstDueDateField: (activityName: string) =>
    JalaliDateTimeField.labelled({
      dateLabel: `${NEW_FIRST_DUE_DATE} ${activityName}`,
      timeLabel: `ساعت ${NEW_FIRST_DUE_DATE} ${activityName}`,
      boundName: `${NEW_FIRST_DUE_DATE} ${activityName}`,
    }),

  /** The open dialog's refusal banner — a problem detail shown inside it. */
  dialogAlert: () =>
    PageElement.located(By.role('alert'))
      .of(openDialog())
      .describedAs("the open dialog's alert"),
};
