import { By, PageElement } from '@serenity-js/web';

const HEADING = 'تعیین تخصص فعالیت های قبلی';

/**
 * Lean Page Object for the system admin's legacy specialty assignment (issue #108): when a System
 * Admin signs in and some activities still have no specialty, a modal lists every one of them,
 * each with its own specialty choice, and assigns them all at once. Locates elements and reports
 * what they say — nothing else; the behaviour lives in
 * `screenplay/maintenance-management/maintenance-activity.ts`.
 *
 * ASSUMPTION — written before the frontend builds it, so every locator below is a contract the
 * frontend is asked to meet, not something seen in a rendered page:
 * - the modal is a `mat-dialog` (`role="dialog"`) whose heading reads «تعیین تخصص فعالیت های قبلی»;
 *   it opens on its own after the sign-in lands, whatever page that is;
 * - each listed activity's choice is a `mat-radio-group` — `role="radiogroup"` whose accessible
 *   name is **exactly the activity's name** (`aria-labelledby` the element showing it) — with two
 *   radios named «برق» and «مکانیک», neither chosen at first;
 * - the dialog submits through a button «ثبت تخصص ها» and closes once the assignment is accepted.
 */
const dialog = () =>
  PageElement.located(By.role('dialog')).describedAs(
    'specialty assignment dialog',
  );

export const SpecialtyAssignmentDialog = {
  heading: () =>
    PageElement.located(By.role('heading', { name: HEADING, exact: true }))
      .of(dialog())
      .describedAs('specialty assignment heading'),

  /** The radio of `label` («برق» / «مکانیک») in the choice of the activity named `activityName`. */
  specialtyOf: (activityName: string, label: string) =>
    PageElement.located(By.role('radio', { name: label, exact: true }))
      .of(
        PageElement.located(
          By.role('radiogroup', { name: activityName, exact: true }),
        ).of(dialog()),
      )
      .describedAs(`«${label}» for «${activityName}»`),

  submitButton: () =>
    PageElement.located(By.role('button', { name: 'ثبت تخصص ها', exact: true }))
      .of(dialog())
      .describedAs('submit specialties button'),

  /** A refused assignment is told in the dialog's `role="alert"` banner (`dialog-alert.ts`). */
  alert: () =>
    PageElement.located(By.role('alert'))
      .of(dialog())
      .describedAs('specialty assignment error message'),
};
