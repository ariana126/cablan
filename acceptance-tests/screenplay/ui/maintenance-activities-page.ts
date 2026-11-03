import { By, PageElement } from '@serenity-js/web';
import { errorOfFieldLabelled } from './form-field';

const NAME_LABEL = 'نام فعالیت';
const SPECIALTY_LABEL = 'تخصص';

/** The add/edit dialog — a `mat-dialog`, `role="dialog"`; only one is open at a time. */
const openDialog = () =>
  PageElement.located(By.role('dialog')).describedAs('activity dialog');

/**
 * ASSUMPTION (issue #108, written before the frontend): the dialog's specialty is a required
 * `mat-radio-group` — `role="radiogroup"` with the accessible name «تخصص» (`aria-labelledby` its
 * visible label) — holding two `mat-radio-button`s named «برق» and «مکانیک», neither chosen in a
 * new activity's dialog, the activity's own chosen in its edit dialog.
 */
const specialtyGroup = () =>
  PageElement.located(
    By.role('radiogroup', { name: SPECIALTY_LABEL, exact: true }),
  )
    .of(openDialog())
    .describedAs('activity specialty choice');

/**
 * Lean Page Object for `/maintenance-activities` («فعالیت های PM» under «اطلاعات پایه» — issue
 * #69, renamed in #76). Locates elements and reports what they say — nothing else; the behaviour
 * lives in `screenplay/maintenance-management/maintenance-activity.ts`.
 *
 * Every locator is confirmed against the source (`frontend/src/app/features/maintenance-activities/`:
 * the page and its form dialog), not yet against a rendered page. Same shape as `equipment-page.ts`.
 */
export const MaintenanceActivitiesPage = {
  /** The page's `<h1>`, «مدیریت» + the menu label. */
  heading: () =>
    PageElement.located(
      By.role('heading', {
        name: 'مدیریت فعالیت های PM',
        level: 1,
        exact: true,
      }),
    ).describedAs('maintenance activities page heading'),

  /** The button that opens the "new activity" dialog. */
  addButton: () =>
    PageElement.located(
      By.role('button', { name: 'افزودن فعالیت', exact: true }),
    ).describedAs('add activity button'),

  /** The one field of the add/edit dialog, a text input labelled «نام فعالیت». */
  nameField: () =>
    PageElement.located(
      By.role('textbox', { name: NAME_LABEL, exact: true }),
    ).describedAs('activity name field'),

  /** The add/edit dialog's submit button. */
  submitButton: () =>
    PageElement.located(
      By.role('button', { name: 'ثبت فعالیت', exact: true }),
    ).describedAs('submit activity button'),

  /**
   * Both name errors — blank and taken (409 `maintenance-activity-name-taken`) — render
   * as the name field's `<mat-error>`. Structural anchor, **not gated**.
   */
  nameError: () => errorOfFieldLabelled(NAME_LABEL),

  /** One of the specialty choices, «برق» or «مکانیک» — a `role="radio"` in the «تخصص» group. */
  specialtyOption: (label: string) =>
    PageElement.located(By.role('radio', { name: label, exact: true }))
      .of(specialtyGroup())
      .describedAs(`«${label}» specialty`),

  /**
   * Submitting with no specialty chosen keeps the dialog open and shows a `<mat-error>` under the
   * radio group, «تخصص فعالیت را انتخاب کنید.» — a radio group sits in no `mat-form-field`, so
   * the error is found by what it says. The name field's errors never mention «تخصص». Structural
   * anchor, **not gated**.
   *
   * A lazily located element, never a filtered list's `.first()`: the submit poll
   * (`WaitForTheDialogToBeAnswered`) asks for it while the dialog is open and before — or without —
   * any error, and `.first()` of an empty list throws `ListItemNotFoundError` there instead of
   * reading as "not shown".
   */
  specialtyError: () =>
    PageElement.located(By.cssContainingText('mat-error', SPECIALTY_LABEL))
      .of(openDialog())
      .describedAs('activity specialty error message'),

  /** Each activity's name is a table cell of the list. */
  activityNamed: (name: string) =>
    PageElement.located(By.role('cell', { name, exact: true })).describedAs(
      `activity named "${name}"`,
    ),

  /** The row's direct edit button, named for the activity («ویرایش تعویض روغن»). */
  editButton: (name: string) =>
    PageElement.located(
      By.role('button', { name: `ویرایش ${name}`, exact: true }),
    ).describedAs(`edit button for "${name}"`),
};
