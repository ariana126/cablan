import { By, PageElement } from '@serenity-js/web';
import { errorOfFieldLabelled, inputOfFieldLabelled } from './form-field';
import { JalaliDateTimeField } from './jalali-datetime-field';

const INTERVAL_LABEL = 'دوره (روز)';
const FIRST_DUE_DATE_LABEL = 'اولین موعد';

/**
 * The plan's data sheet — a `region` named by its «برنامه PM» heading, shown once equipment is
 * picked.
 */
const planSheet = () =>
  PageElement.located(
    By.role('region', { name: 'برنامه PM', exact: true }),
  ).describedAs('PM plan data sheet');

/**
 * Lean Page Object for `/pm-plans` («پرونده فنی تجهیزات» under «فنی» — issues #69, #82). The
 * technical manager picks a piece of equipment and manages its plan: add an activity with an interval in days
 * and a Jalali first due date, change an item's interval, remove an item. Locates elements and
 * reports what they say — nothing else; the behaviour lives in
 * `screenplay/maintenance-management/pm-plan.ts`.
 *
 * Every locator is confirmed against the source (`frontend/src/app/features/pm-plans/`: the page and
 * its add, change-interval and remove dialogs), not yet against a rendered page. The page also
 * shows the equipment's maintenance history, whose «فعالیت» cells carry the same activity names as
 * the plan's — so nothing here finds a plan item by its cell. The page draws two data sheets, each
 * a region named by its `<h2>`: «برنامه PM» (the plan) and «سابقه PM» (the history). The plan
 * items' rows carry the shared data-sheet actions menu («عملیات بیشتر برای {activity}» →
 * «ویرایش» / «حذف», `common/row-actions.ts`): «ویرایش» opens the change-interval dialog, «حذف» the
 * removal confirmation.
 */
export const PmPlansPage = {
  /** The page's `<h1>` is the menu label. */
  heading: () =>
    PageElement.located(
      By.role('heading', { name: 'پرونده فنی تجهیزات', level: 1, exact: true }),
    ).describedAs('PM plans page heading'),

  /**
   * The equipment is chosen in a searchable picker (`app-searchable-select`, a
   * `combobox`) labelled «تجهیز»; its options are named by the equipment's name.
   */
  equipmentPicker: () =>
    PageElement.located(
      By.role('combobox', { name: 'تجهیز', exact: true }),
    ).describedAs('equipment picker'),

  /** An option of whichever picker is open, by its exact name. */
  option: (name: string) =>
    PageElement.located(By.role('option', { name, exact: true })).describedAs(
      `option "${name}"`,
    ),

  /**
   * The button that opens the add-item dialog, in the plan sheet's title bar. Scoped to that
   * sheet, so «افزودن فعالیت» cannot match another button of the same name elsewhere. (The dialog
   * it opens is still titled «افزودن فعالیت به برنامه».)
   */
  addItemButton: () =>
    PageElement.located(
      By.role('button', { name: 'افزودن فعالیت', exact: true }),
    )
      .of(planSheet())
      .describedAs('add activity to plan button'),

  /**
   * The add-item dialog's activity picker — a searchable `combobox` labelled
   * «فعالیت» that offers **every** registered activity, including one already in this plan (the
   * duplicate rule is the backend's 409, and the Gherkin expects its message).
   */
  activityPicker: () =>
    PageElement.located(
      By.role('combobox', { name: 'فعالیت', exact: true }),
    ).describedAs('activity picker'),

  /**
   * The interval field of both the add-item and the change-interval dialogs, labelled
   * «دوره (روز)». Found through its label whatever its input type (`number` makes it a
   * `spinbutton`). Structural anchor, **not gated**.
   */
  intervalField: () => inputOfFieldLabelled(INTERVAL_LABEL),

  /**
   * The first due date is the shared Jalali calendar control — a read-only textbox
   * labelled «اولین موعد» and the calendar toggle «باز کردن تقویم اولین موعد», with no clock
   * (`timeLabel` is never looked for: `PickJalaliDateTime.dateOf`).
   */
  firstDueDateField: () =>
    JalaliDateTimeField.labelled({
      dateLabel: FIRST_DUE_DATE_LABEL,
      timeLabel: 'ساعت اولین موعد',
      boundName: FIRST_DUE_DATE_LABEL,
    }),

  /** The submit button of the add-item and change-interval dialogs. */
  submitButton: () =>
    PageElement.located(
      By.role('button', { name: 'ثبت', exact: true }),
    ).describedAs('submit plan item button'),

  /** A missing or invalid interval shows as that field's `<mat-error>`. Not gated. */
  intervalError: () => errorOfFieldLabelled(INTERVAL_LABEL),

  /** A missing first due date shows as that field's `<mat-error>`. Not gated. */
  firstDueDateError: () => errorOfFieldLabelled(FIRST_DUE_DATE_LABEL),

  /**
   * A refusal that belongs to no one field — 409 `activity-already-in-pm-plan` — is
   * shown in the open dialog as a `role="alert"` with the problem's Persian `detail`, the
   * mechanism the other form dialogs use (`<p class="form-error" role="alert">`).
   */
  dialogAlert: () =>
    PageElement.located(
      By.css('mat-dialog-container [role="alert"]'),
    ).describedAs('plan item dialog error message'),

  /** Any field error in the open dialog — the "the dialog has answered" signal. Not gated. */
  anyFieldError: () =>
    PageElement.located(By.css('mat-dialog-container mat-error')).describedAs(
      'plan item dialog field error',
    ),

  /** The removal confirmation's confirm button. */
  confirmRemovalButton: () =>
    PageElement.located(
      By.role('button', { name: 'حذف از برنامه', exact: true }),
    ).describedAs('confirm removal button'),
};
