import { By, PageElement } from '@serenity-js/web';
import { errorOfFieldLabelled, inputOfFieldLabelled } from './form-field';
import { JalaliDateTimeField } from './jalali-datetime-field';

const INTERVAL_LABEL = 'دوره (روز)';
const FIRST_DUE_DATE_LABEL = 'اولین موعد';

/**
 * The folder's plan section — a `region` named by its «برنامه PM» heading, on
 * `/pm-plans/:equipmentId`.
 */
const planSheet = () =>
  PageElement.located(
    By.role('region', { name: 'برنامه PM', exact: true }),
  ).describedAs('PM plan data sheet');

/**
 * The board of equipment folders (issue #92) — a `region` named «تجهیزات فعال» holding one card per
 * non-retired equipment, whether or not it has a plan. Retired equipment's cards sit outside it, in
 * the collapsed «تجهیزات کنار گذاشته شده» panel.
 */
const equipmentBoard = () =>
  PageElement.located(
    By.role('region', { name: 'تجهیزات فعال', exact: true }),
  ).describedAs('board of active equipment');

/**
 * Lean Page Object for `/pm-plans` («پرونده فنی تجهیزات» under «فنی» — issues #69, #82, #81, #92)
 * and the equipment folder it opens, `/pm-plans/:equipmentId`. The board shows a folder card for
 * every active equipment; clicking one opens that equipment's folder — its name as the `<h1>`, its
 * status («فعال» / «کنار گذاشته شده»), a «بازگشت به پرونده‌ها» link, then two data sheets, each a
 * region named by its `<h2>`: «برنامه PM» (the plan, with «افزودن فعالیت» in its title bar even
 * when the plan is empty) and «سابقه PM» (the history). There the technical manager manages the
 * plan: add an activity with an interval in days and a Jalali first due date, change an item's
 * interval, remove an item. Locates elements and reports what they say — nothing else; the
 * behaviour lives in `screenplay/maintenance-management/pm-plan.ts`.
 *
 * The sheet, dialog and row-menu locators were confirmed against the source of the earlier page
 * and are unchanged by issue #92; the board, card and folder locators are issue #92's contract as
 * the frontend reported it, not yet seen on a rendered page. The history's «فعالیت» cells carry the
 * same activity names as the plan's — so nothing here finds a plan item by its cell. The plan
 * items' rows carry the shared data-sheet actions menu («عملیات بیشتر برای {activity}» →
 * «ویرایش» / «حذف», `common/row-actions.ts`): «ویرایش» opens the change-interval dialog, «حذف» the
 * removal confirmation.
 */
export const PmPlansPage = {
  /** The board page's `<h1>` is the menu label. */
  heading: () =>
    PageElement.located(
      By.role('heading', { name: 'پرونده فنی تجهیزات', level: 1, exact: true }),
    ).describedAs('PM plans page heading'),

  /**
   * An equipment's folder card on the board — a `link` to `/pm-plans/:equipmentId` whose accessible
   * name is exactly the equipment's name (the visible «N فعالیت فعال» / «بدون برنامه PM» line is
   * not part of it). Scoped to the board, so neither a retired equipment's card (links too, in the
   * archive) nor anything in a dialog can match.
   */
  equipmentCard: (equipmentName: string) =>
    PageElement.located(By.role('link', { name: equipmentName, exact: true }))
      .of(equipmentBoard())
      .describedAs(`card of equipment "${equipmentName}"`),

  /** The folder view's `<h1>` is the equipment's name. */
  folderHeading: (equipmentName: string) =>
    PageElement.located(
      By.role('heading', { name: equipmentName, level: 1, exact: true }),
    ).describedAs(`folder heading of "${equipmentName}"`),

  /** The folder's link back to the board. */
  backToFoldersLink: () =>
    PageElement.located(
      By.role('link', { name: 'بازگشت به پرونده‌ها', exact: true }),
    ).describedAs('back to folders link'),

  /** An option of the open picker, by its exact name. */
  option: (name: string) =>
    PageElement.located(By.role('option', { name, exact: true })).describedAs(
      `option "${name}"`,
    ),

  /**
   * The button that opens the add-item dialog, in the folder's plan sheet's title bar — drawn also
   * when the plan is empty (issue #92). Scoped to that sheet, so «افزودن فعالیت» cannot match
   * another button of the same name elsewhere. (The dialog it opens is still titled «افزودن فعالیت
   * به برنامه».)
   */
  addItemButton: () =>
    PageElement.located(
      By.role('button', { name: 'افزودن فعالیت', exact: true }),
    )
      .of(planSheet())
      .describedAs('add activity to plan button'),

  /**
   * The add-item dialog's activity picker — a searchable `combobox` labelled «فعالیت» that offers
   * **every** registered activity, including one already in this plan (the duplicate rule is the
   * backend's 409, and the Gherkin expects its message).
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
