import { By, PageElement, PageElements } from '@serenity-js/web';

/**
 * The table of one equipment's activities: the first table after the `h3` that names the
 * equipment, inside the equipment's `<section>`. Equipment names in the specs never hold an
 * apostrophe, so the name is a plain XPath string literal. Structural, **not gated**.
 */
const activitiesTableOf = (equipmentName: string) =>
  PageElement.located(
    By.xpath(
      `(//h3[normalize-space(.)='${equipmentName}']/following::table)[1]`,
    ),
  ).describedAs(`QC activities table of "${equipmentName}"`);

/**
 * Lean Page Object for `/qc-inspection` («بازرسی حین تولید» under «کنترل کیفیت» — issue #119): the
 * «اسکن QR تجهیز» button, and below it every in-service equipment's assigned activities with their
 * last execution, which the inspector schedules their next inspections from. **The list is view
 * only** (the scan-only rule, `docs/superpowers/specs/2026-11-24-qc-scan-only-recording-design.md`):
 * nothing on it records — recording starts from a scan, in `QcRecordingDialog` below. Locates
 * elements and reports what they say — nothing else; the behaviour lives in
 * `screenplay/quality-control/qc-inspection.ts` and `qc-submission.ts`.
 *
 * Confirmed against the source (`frontend/src/app/features/qc-inspection/qc-inspection-page.ts`):
 * an `<h1>` «بازرسی حین تولید»; per equipment a `<section>` named by its `h3` (the equipment's
 * name) around a `mat-table` whose header cells read «فعالیت» and «آخرین انجام»; a last execution
 * in Tehran time with **Persian digits** («۱۴۰۵/۰۷/۰۱ ۱۰:۰۰») or «بدون سابقه» — the domain layer reads
 * it back as the Gherkin writes it (`maintenance-pages.ts#asTheGherkinWritesIt`). A `role=
 * "progressbar"` only while the list loads. Header text and table structure are **not gated** by
 * the accessibility check.
 */
export const QcInspectionPage = {
  heading: () =>
    PageElement.located(
      By.role('heading', { name: 'بازرسی حین تولید', level: 1, exact: true }),
    ).describedAs('QC inspection page heading'),

  loadingIndicator: () =>
    PageElement.located(By.css('[role="progressbar"]')).describedAs(
      'QC inspection loading indicator',
    ),

  activitiesTableOf,

  /** The header cells of one equipment's table. Structural, ungated. */
  columnHeadersOf: (equipmentName: string) =>
    PageElements.located(By.css('thead th'))
      .of(activitiesTableOf(equipmentName))
      .describedAs(`QC activity column headers of "${equipmentName}"`),

  /** One body row per assigned activity. Structural, ungated. */
  rowsOf: (equipmentName: string) =>
    PageElements.located(By.css('tbody tr'))
      .of(activitiesTableOf(equipmentName))
      .describedAs(`QC activity rows of "${equipmentName}"`),

  /** The cells of one row — scope with `.of(row)`. Structural, ungated. */
  rowCells: () =>
    PageElements.located(By.css('td')).describedAs('QC activity row cells'),

  /**
   * «اسکن QR تجهیز», the filled button in the page header that opens the camera dialog. ASSUMPTION
   * until a suite run confirms it.
   */
  scanButton: () =>
    PageElement.located(
      By.role('button', { name: 'اسکن QR تجهیز', exact: true }),
    ).describedAs('the scan button of the QC inspection page'),

  /**
   * One equipment's `<section>` — the one holding the `h3` that names it — found structurally
   * rather than as a `region` by role, so it is still reachable while an open dialog marks the page
   * behind it `aria-hidden`. Used to prove what the section does **not** hold. Structural, **not
   * gated**.
   */
  equipmentSection: (equipmentName: string) =>
    PageElement.located(
      By.xpath(`//section[.//h3[normalize-space(.)='${equipmentName}']]`),
    ).describedAs(`the QC section of "${equipmentName}"`),

  /**
   * Any checkbox — native or ARIA, hidden from assistive technology or not. Scope with
   * `.of(section)`; the view-only list draws none. Structural, ungated.
   */
  checkboxes: () =>
    PageElements.located(
      By.css('input[type="checkbox"], [role="checkbox"]'),
    ).describedAs('checkboxes'),

  /**
   * Any button reading «ثبت انجام» — scope with `.of(section)`; the view-only list draws none. By
   * text rather than role for the same reason as `equipmentSection`. Structural, ungated.
   */
  recordButtons: () =>
    PageElements.located(
      By.xpath(`.//button[normalize-space(.)='ثبت انجام']`),
    ).describedAs('«ثبت انجام» buttons'),
};

/**
 * The scan dialog «اسکن QR تجهیز» opens (`QcScanDialog`): the camera's picture, and «انصراف».
 * ASSUMPTION: a `role="dialog"` named by its head, «اسکن QR تجهیز».
 */
export const QcScanDialog = {
  dialog: () =>
    PageElement.located(
      By.role('dialog', { name: 'اسکن QR تجهیز', exact: true }),
    ).describedAs('the QR scan dialog'),
};

/**
 * The recording dialog a scan opens (`QcRecordingDialog`, the scan-only rule): `role="dialog"`
 * named exactly by the scanned equipment, a checkbox per assigned activity named by it, a ticked
 * one's «توضیحات <activity>», «ثبت انجام» and the footer's «پایان». Every locator is an ASSUMPTION
 * until a suite run confirms it against the frontend's markup.
 *
 * The submission dialog «ثبت انجام» opens over it carries the **same** accessible name (its head is
 * the equipment's name too), so this is the *first* dialog of that name — the one opened earlier.
 */
const recordingDialogOf = (equipmentName: string) =>
  PageElements.located(By.role('dialog', { name: equipmentName, exact: true }))
    .first()
    .describedAs(`the QC recording dialog of "${equipmentName}"`);

export const QcRecordingDialog = {
  dialogOf: recordingDialogOf,

  /** Every open dialog named by the equipment — none, when its recording is not offered. */
  dialogsNamed: (equipmentName: string) =>
    PageElements.located(
      By.role('dialog', { name: equipmentName, exact: true }),
    ).describedAs(`dialogs named "${equipmentName}"`),

  /** ASSUMPTION: a checkbox per assigned activity, named exactly by the activity. */
  activityCheckbox: (equipmentName: string, activityName: string) =>
    PageElement.located(
      By.role('checkbox', { name: activityName, exact: true }),
    )
      .of(recordingDialogOf(equipmentName))
      .describedAs(`the "${activityName}" checkbox of "${equipmentName}"`),

  /** Every checkbox in the dialog — their accessible names are the activities it offers. */
  activityCheckboxes: (equipmentName: string) =>
    PageElements.located(By.role('checkbox'))
      .of(recordingDialogOf(equipmentName))
      .describedAs(`the activity checkboxes of "${equipmentName}"`),

  /** ASSUMPTION: a ticked activity's notes textbox, labelled «توضیحات <activity>». */
  activityNotesField: (equipmentName: string, activityName: string) =>
    PageElement.located(
      By.role('textbox', { name: `توضیحات ${activityName}`, exact: true }),
    )
      .of(recordingDialogOf(equipmentName))
      .describedAs(`the notes of "${activityName}" on "${equipmentName}"`),

  /** ASSUMPTION: «ثبت انجام», which opens the submission dialog. */
  recordButton: (equipmentName: string) =>
    PageElement.located(By.role('button', { name: 'ثبت انجام', exact: true }))
      .of(recordingDialogOf(equipmentName))
      .describedAs(`the record button of "${equipmentName}"`),

  /** ASSUMPTION: «پایان», the footer button that closes the recording dialog. */
  finishButton: (equipmentName: string) =>
    PageElement.located(By.role('button', { name: 'پایان', exact: true }))
      .of(recordingDialogOf(equipmentName))
      .describedAs(`the finish button of "${equipmentName}"`),
};

/**
 * The submission dialog «ثبت انجام» opens (issue #132, unchanged by the scan-only rule): it asks
 * for the tracking number once, then shows each activity's outcome («ثبت شد» / «ثبت نشد — …») in
 * place, with «بستن». It is stacked over the recording dialog, so it is the **last** dialog open.
 * Every locator is an ASSUMPTION until a suite run confirms it.
 */
const submissionDialog = () =>
  PageElements.located(By.role('dialog'))
    .last()
    .describedAs('the QC submission dialog');

export const QcSubmissionDialog = {
  /**
   * ASSUMPTION: a textbox labelled «شماره ردیابی». Not `exact`, since a required Material field's
   * accessible name may carry its asterisk. Present exactly while the submission asks for it.
   */
  trackingNumberField: () =>
    PageElement.located(By.role('textbox', { name: 'شماره ردیابی' }))
      .of(submissionDialog())
      .describedAs('the tracking number field of the QC submission dialog'),

  /** ASSUMPTION: the submit button, exactly «ثبت». */
  submitButton: () =>
    PageElement.located(By.role('button', { name: 'ثبت', exact: true }))
      .of(submissionDialog())
      .describedAs('the submit button of the QC submission dialog'),

  /**
   * ASSUMPTION: «بستن», shown with the per-activity result. Unscoped on purpose: no other dialog
   * that can be open has a button of that name (the recording dialog's footer is «پایان»).
   */
  closeButton: () =>
    PageElement.located(
      By.role('button', { name: 'بستن', exact: true }),
    ).describedAs('the close button of the QC submission dialog'),
};
