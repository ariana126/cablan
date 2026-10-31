import { By, PageElement } from '@serenity-js/web';
import { errorOfFieldLabelled } from './form-field';

const NAME_LABEL = 'نام فعالیت';

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
