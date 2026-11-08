import { By, PageElement, PageElements } from '@serenity-js/web';
import { errorOfFieldLabelled, inputOfFieldLabelled } from './form-field';
import { JalaliDateTimeField } from './jalali-datetime-field';

const INTERVAL_LABEL = 'دوره (روز)';
const FIRST_DUE_DATE_LABEL = 'اولین موعد';
const DEACTIVATE = 'غیرفعال\u200cسازی';
const INACTIVE_ITEMS_HEADING = 'فعالیت\u200cهای غیرفعال';

/**
 * The folder's plan section — a `region` named by its «برنامه PM» heading, on
 * `/pm-plans/:equipmentId`.
 */
const planSheet = () =>
  PageElement.located(
    By.role('region', { name: 'برنامه PM', exact: true }),
  ).describedAs('PM plan data sheet');

/**
 * ASSUMPTION (issue #91, not yet built): the folder's read-only list of deactivated plan rows — a
 * `region` named by its «فعالیت‌های غیرفعال» heading, collapsed until shown (issue #112 —
 * `showInactiveItemsButton`), holding one native `<table mat-table>` per
 * specialty group (issue #108) with the columns «فعالیت», «دوره (روز)», «اولین موعد», «زمان غیرفعال
 * شدن» (Jalali `yyyy/MM/dd HH:mm`, Tehran time). Since issue #110 the System Admin also sees a
 * trailing visually-hidden «عملیات» column holding each row's «حذف همه سوابق» and «حذف ردیف»
 * buttons (confirmed against source); readers compare only the columns the Gherkin names.
 */
const inactiveSheet = () =>
  PageElement.located(
    By.role('region', { name: INACTIVE_ITEMS_HEADING, exact: true }),
  ).describedAs('inactive plan items sheet');

/**
 * The folder's history section — a `region` named by its «سابقه PM» heading. Confirmed against
 * source (issue #110): its rows are native `<table mat-table>` rows (one table, or one per group) with the
 * columns «فعالیت» and «موعد» among others, and — for the System Admin — a «حذف سابقه» button in
 * each row.
 */
const historySheet = () =>
  PageElement.located(
    By.role('region', { name: 'سابقه PM', exact: true }),
  ).describedAs('PM history data sheet');

/** Issue #110: the confirmation dialogs the folder opens are `mat-dialog`s (confirmed against source). */
const openDialog = () =>
  PageElement.located(By.role('dialog')).describedAs('the open dialog');

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
 * interval, deactivate an item (issue #91), and see the deactivated items. Locates elements and reports what they say — nothing else; the
 * behaviour lives in `screenplay/maintenance-management/pm-plan.ts`.
 *
 * The sheet, dialog and row-menu locators were confirmed against the source of the earlier page
 * and are unchanged by issue #92; the board, card and folder locators are issue #92's contract as
 * the frontend reported it, not yet seen on a rendered page. The history's «فعالیت» cells carry the
 * same activity names as the plan's — so nothing here finds a plan item by its cell. The plan
 * items' rows carry the shared data-sheet actions menu («عملیات بیشتر برای {activity}» →
 * «ویرایش» / «غیرفعال‌سازی», `common/row-actions.ts`): «ویرایش» opens the change-interval dialog,
 * «غیرفعال‌سازی» the deactivation confirmation (issue #91 — it replaced «حذف»). The deactivation
 * dialog and the «فعالیت‌های غیرفعال» sheet are issue #91's contract as the dispatch pins it, every
 * one of their locators an ASSUMPTION until the frontend builds them.
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

  /**
   * ASSUMPTION (issue #91): the deactivation confirmation's title, a heading
   * «غیرفعال‌سازی فعالیت در برنامه» (`mat-dialog-title`).
   */
  deactivationDialogHeading: () =>
    PageElement.located(
      By.role('heading', {
        name: `${DEACTIVATE} فعالیت در برنامه`,
        exact: true,
      }),
    ).describedAs('deactivation confirmation heading'),

  /**
   * ASSUMPTION (issue #91): the deactivation confirmation's confirm button, «غیرفعال‌سازی». The row
   * menu's item of the same name is a `menuitem`, not a `button`, and the open dialog hides the page
   * behind it, so this cannot match anything else.
   */
  confirmDeactivationButton: () =>
    PageElement.located(
      By.role('button', { name: DEACTIVATE, exact: true }),
    ).describedAs('confirm deactivation button'),

  /** ASSUMPTION (issue #91): the «فعالیت‌های غیرفعال» sheet itself. */
  inactiveItemsSheet: () => inactiveSheet(),

  /**
   * Issue #112, confirmed against source: the sheet opens **collapsed** — its heading and «N نتیجه»
   * count are drawn, but its tables (and with them the System Admin's «حذف همه سوابق» / «حذف ردیف»)
   * are not in the DOM until the title bar's disclosure button is clicked. The button is drawn only
   * while the sheet has a row; it reads «نمایش» shut and «پنهان کردن» open (`aria-expanded`).
   */
  showInactiveItemsButton: () =>
    PageElement.located(By.role('button', { name: 'نمایش', exact: true }))
      .of(inactiveSheet())
      .describedAs('show inactive plan items button'),

  hideInactiveItemsButton: () =>
    PageElement.located(By.role('button', { name: 'پنهان کردن', exact: true }))
      .of(inactiveSheet())
      .describedAs('hide inactive plan items button'),

  /**
   * The inactive sheet's tables (issue #108): one per specialty group — `app-specialty-group`, a
   * `<section>` headed «برق», «مکانیک» or «تخصص تعیین نشده», in that order, empty groups left out —
   * each a native `<table mat-table>` with the same columns. Structural, ungated.
   */
  inactiveItemsTables: () =>
    PageElements.located(By.css('table'))
      .of(inactiveSheet())
      .describedAs('inactive plan items tables'),

  /** One inactive table's header cells, `<th>`. Structural, ungated. */
  inactiveItemsColumnHeadersOf: (table: PageElement) =>
    PageElements.located(By.css('thead th'))
      .of(table)
      .describedAs('inactive plan items column headers'),

  /**
   * One inactive table's body rows, one per deactivated plan row, `tbody tr.mat-mdc-row` (a
   * Material no-data row would not carry the class). Inside a group they keep the sheet's order,
   * first deactivated first. Structural, ungated.
   */
  inactiveItemsRowsOf: (table: PageElement) =>
    PageElements.located(By.css('tbody tr.mat-mdc-row'))
      .of(table)
      .describedAs('inactive plan items rows'),

  /** The cells of one inactive row — scope with `.of(row)`. Structural, ungated. */
  inactiveItemsRowCells: () =>
    PageElements.located(By.css('td')).describedAs('inactive plan item cells'),

  // Issue #110 — the System Admin's deletions, confirmed against source (`features/pm-plans/`), not
  // yet against a rendered page. The buttons are named exactly «حذف سابقه» / «حذف ردیف» / «حذف همه
  // سوابق» and told apart only by `aria-describedby` (activity + due date or interval), so they are
  // reached through their row; the tables are structural anchors, **not gated**. A deactivated row
  // has «حذف همه سوابق» and «حذف ردیف» buttons; an active row keeps «حذف همه سوابق» in its menu.

  /** The history sheet's tables. Structural, ungated. */
  historyTables: () =>
    PageElements.located(By.css('table'))
      .of(historySheet())
      .describedAs('PM history tables'),

  /** One history table's header cells, `<th>`. Structural, ungated. */
  historyColumnHeadersOf: (table: PageElement) =>
    PageElements.located(By.css('thead th'))
      .of(table)
      .describedAs('PM history column headers'),

  /** One history table's body rows. Structural, ungated. */
  historyRowsOf: (table: PageElement) =>
    PageElements.located(By.css('tbody tr.mat-mdc-row'))
      .of(table)
      .describedAs('PM history rows'),

  /** The cells of one history row — scope with `.of(row)`. Structural, ungated. */
  historyRowCells: () =>
    PageElements.located(By.css('td')).describedAs('PM history cells'),

  /** A history row's «حذف سابقه» button — scope with `.of(row)`. */
  deleteExecutionButton: () =>
    PageElement.located(
      By.role('button', { name: 'حذف سابقه', exact: true }),
    ).describedAs('delete execution button'),

  /** The execution deletion's confirmation («حذف سابقه انجام») (naming activity, due date and performer). */
  confirmExecutionDeletionButton: () =>
    PageElement.located(By.role('button', { name: 'حذف سابقه', exact: true }))
      .of(openDialog())
      .describedAs('confirm execution deletion button'),

  /**
   * «حذف همه سوابق»'s confirmation (naming the row and the count) — reached from the
   * plan row's menu (`common/row-actions.ts#deleteAllExecutionsMenuItem`).
   */
  confirmDeletionOfAllExecutionsButton: () =>
    PageElement.located(
      By.role('button', { name: 'حذف همه سوابق', exact: true }),
    )
      .of(openDialog())
      .describedAs('confirm deletion of all executions button'),

  /** An inactive row's «حذف ردیف» button — scope with `.of(row)`. */
  deleteInactiveItemButton: () =>
    PageElement.located(
      By.role('button', { name: 'حذف ردیف', exact: true }),
    ).describedAs('delete inactive plan row button'),

  /** The inactive row deletion's confirmation («حذف ردیف غیرفعال برنامه») (the row and all its executions go). */
  confirmInactiveItemDeletionButton: () =>
    PageElement.located(By.role('button', { name: 'حذف ردیف', exact: true }))
      .of(openDialog())
      .describedAs('confirm inactive plan row deletion button'),

  /** The open dialog's refusal banner — a problem detail shown inside it. */
  openDialogAlert: () =>
    PageElement.located(By.role('alert'))
      .of(openDialog())
      .describedAs("the open dialog's alert"),
};
