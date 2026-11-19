import {
  actorCalled,
  d,
  Interaction,
  Question,
  QuestionAdapter,
  Task,
} from '@serenity-js/core';
import { Ensure, equals, isTrue } from '@serenity-js/assertions';
import { LastResponse, PostRequest, Send } from '@serenity-js/rest';
import { Click, isVisible, Text } from '@serenity-js/web';
import { WaitUntil } from '../common/polling';
import { ChooseFileThrough, FileToUpload } from '../common/uploads';
import { LogInAsPersona } from '../common/personas';
import { keepingTheSpotlight } from '../common/spotlight';
import { taskDependingOn } from '../common/task-depending-on';
import { PmPlansPage } from '../ui/pm-plans-page';
import { PmPlanImportDialog } from '../ui/pm-plan-import-dialog';
import {
  asTheGherkinWritesIt,
  ListRow,
  LocatePmPlansPage,
  TheRowsOfEveryTable,
} from './maintenance-pages';
import {
  aPmPlanSheetWithTheUndefinedActivity,
  PM_PLAN_EXCEL_FILE_NAME,
  PM_PLAN_EXCEL_MIME_TYPE,
  pmPlanExcelFile,
  PmPlanSheet,
} from './pm-plan-excel';
import { EnsureNoActivityIsActiveInPmPlan } from './pm-plan';
import {
  everyRegisteredEquipment,
  theMaintenanceTaskNamed,
} from './maintenance-records';

/**
 * Domain layer for «بارگذاری گروهی برنامه PM از اکسل» (`importing-pm-plans.feature`, issue #127). The
 * System Admin uploads the plant's PM matrix; the system checks the whole file and shows every
 * error, what it would add, what is already in force and what differs from an active row; only an
 * error-free file can be confirmed, and confirming adds every new row or none.
 *
 * Two doors, per acceptance-tests/CLAUDE.md:
 * - **the browser** (`…using`): `/pm-plans`' «بارگذاری از اکسل» and the dialog it opens
 *   (`ui/pm-plan-import-dialog.ts`) — for the active `When`s, whose `Then`s read what the import
 *   reported off that dialog;
 * - **HTTP** (`…viaApiUsing`): `POST pm-plan-imports/preview` (stateless) and `POST pm-plan-imports`
 *   (the same file again; 201, or 400 `pm-plan-import-has-errors`) — multipart, field `file` — for
 *   the «تلاش …» attempts and the passive preconditions.
 */

/** One error as the Gherkin states it; `value` absent when the step names none. */
export interface ExpectedImportError {
  cell: string;
  reason: string;
  value?: string;
}

/** What a conflict differs in, as `PmPlanImportConflict.differences` names it. */
export type PlanItemDifference = 'intervalDays' | 'firstDueDate';

/** The «اختلاف» cell of the conflicts table, by what differs. */
const DIFFERENCE_LABELS: Record<PlanItemDifference, string> = {
  intervalDays: 'دوره',
  firstDueDate: 'اولین موعد',
};

const differenceLabel = (differences: PlanItemDifference[]): string =>
  (['intervalDays', 'firstDueDate'] as const)
    .filter((difference) => differences.includes(difference))
    .map((difference) => DIFFERENCE_LABELS[difference])
    .join(' و ');

interface PmPlanImportError {
  sheet: string;
  cell: string;
  row: number;
  column: string;
  value: string;
  reason: string;
  message: string;
}

interface PmPlanImportPreview {
  sheetName: string;
  counts: {
    toCreate: number;
    alreadyExisting: number;
    conflicts: number;
    errors: number;
  };
  errors: PmPlanImportError[];
}

// ---------------------------------------------------------------------------------------------
// The sheet last uploaded — what «همان اکسل» means
// ---------------------------------------------------------------------------------------------

let lastSheet: PmPlanSheet | undefined;

/** Cleared before every scenario, so no sheet outlives the scenario that uploaded it. */
export const forgetThePmPlanSheets = (): void => {
  lastSheet = undefined;
};

/** «همان اکسل» — the sheet the scenario uploaded last, through either door. */
export const thePmPlanSheetLastUploaded = (): PmPlanSheet => {
  if (!lastSheet) {
    throw new Error('No PM plan Excel has been uploaded in this scenario.');
  }
  return lastSheet;
};

const RememberTheSheet = (sheet: PmPlanSheet): Interaction =>
  Interaction.where('#actor remembers the uploaded PM plan Excel', () => {
    lastSheet = sheet;
  });

const fileOf = (sheet: PmPlanSheet): FileToUpload => ({
  name: PM_PLAN_EXCEL_FILE_NAME,
  mimeType: PM_PLAN_EXCEL_MIME_TYPE,
  buffer: Question.about('the PM plan Excel', () => pmPlanExcelFile(sheet)),
});

const multipartBodyOf = (sheet: PmPlanSheet) =>
  Question.about('the PM plan Excel, as a multipart form', async () => {
    const buffer = await pmPlanExcelFile(sheet);
    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(buffer)], { type: PM_PLAN_EXCEL_MIME_TYPE }),
      PM_PLAN_EXCEL_FILE_NAME,
    );
    return form;
  });

// ---------------------------------------------------------------------------------------------
// The dialog — what the check and the import report
// ---------------------------------------------------------------------------------------------

const ADDABLE_COUNT = /(?:^|[^0-9])([0-9]+) برنامه قابل ثبت است/;

/** The open import dialog's text, as the Gherkin writes it (Latin digits, whitespace collapsed). */
const TheDialogText = (): QuestionAdapter<string> =>
  Question.about('the PM plan import dialog text', async (actor) =>
    asTheGherkinWritesIt(
      await actor.answer(Text.of(PmPlanImportDialog.dialog())),
    ),
  );

/** «N برنامه قابل ثبت است» — N, or -1 when the dialog says no such thing. */
const TheNumberOfPlanItemsThatCanBeAdded = (): QuestionAdapter<number> =>
  Question.about('how many plan items the import can add', async (actor) => {
    const match = ADDABLE_COUNT.exec(await actor.answer(TheDialogText()));
    return match ? Number(match[1]) : -1;
  });

/**
 * The check has rendered once the dialog is on screen and shows the system's answer: its
 * «N برنامه قابل ثبت است» line, or one of its tables.
 */
const TheImportCheckHasRendered = (): QuestionAdapter<boolean> =>
  Question.about(
    'whether the PM plan import check has rendered',
    async (actor) => {
      const dialog = await actor.answer(PmPlanImportDialog.dialog());
      if (!(await dialog.isVisible())) {
        return false;
      }
      if (ADDABLE_COUNT.test(await actor.answer(TheDialogText()))) {
        return true;
      }
      return (await actor.answer(PmPlanImportDialog.tables().count())) > 0;
    },
  );

/** The confirmation has been answered: the result is shown («بستن»), or the dialog says why not. */
const TheImportHasBeenAnswered = (): QuestionAdapter<boolean> =>
  Question.about(
    'whether the PM plan import has been answered',
    async (actor) => {
      const close = await actor.answer(PmPlanImportDialog.closeButton());
      if (await close.isPresent()) {
        return true;
      }
      const alert = await actor.answer(PmPlanImportDialog.alert());
      return alert.isPresent();
    },
  );

/** Whether «تایید» can be pressed — it is disabled while the file has errors. */
const TheImportCanBeConfirmed = (): QuestionAdapter<boolean> =>
  Question.about(
    'whether the PM plan import can be confirmed',
    async (actor) => {
      const confirm = await actor.answer(PmPlanImportDialog.confirmButton());
      return (await confirm.isPresent()) && confirm.isEnabled();
    },
  );

const everyTableOfTheDialog = {
  tables: () => PmPlanImportDialog.tables(),
  columnHeadersOf: PmPlanImportDialog.columnHeadersOf,
  rowsOf: PmPlanImportDialog.rowsOf,
  rowCells: () => PmPlanImportDialog.rowCells(),
};

/** Every row of every table in the dialog, each keyed by its own table's column headers. */
const TheDialogRows = (): QuestionAdapter<ListRow[]> =>
  TheRowsOfEveryTable('the PM plan import tables', everyTableOfTheDialog);

/** The errors table's rows — the rows with a «علت» column. */
const TheImportErrors = (): QuestionAdapter<ListRow[]> =>
  Question.about('the errors the PM plan import shows', async (actor) =>
    (await actor.answer(TheDialogRows())).filter((row) => 'علت' in row),
  );

/** The conflicts table's rows — the rows with an «اختلاف» column. */
const TheImportConflicts = (): QuestionAdapter<ListRow[]> =>
  Question.about('the conflicts the PM plan import reports', async (actor) =>
    (await actor.answer(TheDialogRows())).filter((row) => 'اختلاف' in row),
  );

/** The «از قبل موجود» section's rows. */
const TheItemsAlreadyExisting = (): QuestionAdapter<ListRow[]> =>
  TheRowsOfEveryTable('the plan items the PM plan import found existing', {
    ...everyTableOfTheDialog,
    tables: () => PmPlanImportDialog.alreadyExistingTables(),
  });

/** An empty cell may be drawn as a dash; the Gherkin writes it `""`. */
const asAValue = (text: string): string =>
  text === '-' || text === '—' ? '' : text;

const errorKey = ({ cell, value, reason }: Required<ExpectedImportError>) =>
  `${cell} | ${value} | ${reason}`;

const errorKeysOf = (rows: ListRow[]): string[] =>
  rows
    .map((row) =>
      errorKey({
        cell: row['خانه'] ?? '',
        value: asAValue(row['مقدار'] ?? ''),
        reason: row['علت'] ?? '',
      }),
    )
    .sort();

// ---------------------------------------------------------------------------------------------
// Uploading and confirming
// ---------------------------------------------------------------------------------------------

export const UploadPmPlanExcel = {
  /**
   * Uploads the sheet through `/pm-plans`' «بارگذاری از اکسل» and waits for the system's check to
   * render in the dialog it opens. Nothing is stored yet.
   */
  using: (sheet: PmPlanSheet): Task =>
    Task.where(
      d`#actor uploads a PM plan Excel of ${sheet.equipmentNames().length} equipment and ${sheet.activityNames().length} activities`,
      RememberTheSheet(sheet),
      LocatePmPlansPage(),
      WaitUntil(PmPlansPage.importFromExcelButton(), isVisible()),
      ChooseFileThrough(PmPlansPage.importFromExcelButton(), fileOf(sheet)),
      WaitUntil(TheImportCheckHasRendered(), isTrue()),
    ),

  /** `POST pm-plan-imports/preview` — stateless: it checks and compares, and writes nothing. */
  viaApiUsing: (sheet: PmPlanSheet): Task =>
    Task.where(
      d`#actor uploads a PM plan Excel of ${sheet.equipmentNames().length} equipment (via API)`,
      RememberTheSheet(sheet),
      Send.a(
        PostRequest.to('pm-plan-imports/preview').with(multipartBodyOf(sheet)),
      ),
    ),
};

/**
 * The dialog's «تایید», then waiting for the result. A file with errors offers no confirmation —
 * «تایید» is disabled — and a visitor told so has nothing to press, so the import stops at the
 * check; the scenario's `Then`s say what that means (the errors shown, nothing added).
 */
const ConfirmThePmPlanImportIfOffered = (): Task =>
  taskDependingOn(
    '#actor confirms the PM plan import, if it can be confirmed',
    TheImportCanBeConfirmed(),
    (offered) =>
      offered
        ? [
            Click.on(PmPlanImportDialog.confirmButton()),
            WaitUntil(TheImportHasBeenAnswered(), isTrue()),
          ]
        : [],
  );

export const ImportPmPlanExcel = {
  /** Uploads the sheet through the browser and confirms what the check offers. */
  using: (sheet: PmPlanSheet): Task =>
    Task.where(
      '#actor uploads a PM plan Excel and confirms it',
      UploadPmPlanExcel.using(sheet),
      ConfirmThePmPlanImportIfOffered(),
    ),

  /** `POST pm-plan-imports` with the file — the request that adds the rows. */
  viaApiUsing: (sheet: PmPlanSheet): Task =>
    Task.where(
      d`#actor imports a PM plan Excel of ${sheet.equipmentNames().length} equipment (via API)`,
      RememberTheSheet(sheet),
      Send.a(PostRequest.to('pm-plan-imports').with(multipartBodyOf(sheet))),
    ),
};

// ---------------------------------------------------------------------------------------------
// Preconditions — the API door, as the persona named, spotlight untouched
// ---------------------------------------------------------------------------------------------

/** The last preview names `activityName` as an undefined activity. */
const EnsureThePreviewFoundTheUndefinedActivity = (
  activityName: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures the check found ${activityName} undefined`,
    async (actor) => {
      const { errors } = await actor.answer(
        LastResponse.body<PmPlanImportPreview>(),
      );
      await Ensure.that(
        errors.some(
          (error) =>
            error.reason === 'activity-not-found' &&
            error.value === activityName,
        ),
        isTrue(),
      ).performAs(actor);
    },
  );

/** «اینکه {actor} اکسل برنامه PM ای بارگذاری کرده باشد که فعالیت «…» آن تعریف نشده است» */
export const uploadWithAnUndefinedActivityAsAPrecondition = (
  importerName: string,
  activityName: string,
): Promise<void> =>
  keepingTheSpotlight(() =>
    actorCalled(importerName).attemptsTo(
      LogInAsPersona(importerName),
      UploadPmPlanExcel.viaApiUsing(
        aPmPlanSheetWithTheUndefinedActivity(activityName),
      ),
      Ensure.that(LastResponse.status(), equals(200)),
      EnsureThePreviewFoundTheUndefinedActivity(activityName),
    ),
  );

/** «اینکه {actor} اکسل برنامه PM زیر را بارگذاری و تایید کرده باشد» — checked, then imported. */
export const importAsAPrecondition = (
  importerName: string,
  sheet: PmPlanSheet,
): Promise<void> =>
  keepingTheSpotlight(() =>
    actorCalled(importerName).attemptsTo(
      LogInAsPersona(importerName),
      UploadPmPlanExcel.viaApiUsing(sheet),
      Ensure.that(LastResponse.status(), equals(200)),
      ImportPmPlanExcel.viaApiUsing(sheet),
      Ensure.that(LastResponse.status(), equals(201)),
    ),
  );

// ---------------------------------------------------------------------------------------------
// What the import reported — off the dialog
// ---------------------------------------------------------------------------------------------

/** «به او گفته شود که N برنامه قابل ثبت است» */
export const EnsureToldHowManyPlanItemsCanBeAdded = (count: number): Task =>
  Task.where(
    d`#actor ensures they were told ${count} plan items can be added`,
    Ensure.that(TheNumberOfPlanItemsThatCanBeAdded(), equals(count)),
  );

/** «خطاهای زیر نشان داده شوند» — exactly these errors, whatever their order. */
export const EnsurePmPlanImportShowsTheErrors = (
  expected: ExpectedImportError[],
): Task =>
  Task.where(
    d`#actor ensures the import shows exactly ${expected.length} errors`,
    Ensure.that(
      Question.about('the errors shown', async (actor) =>
        errorKeysOf(await actor.answer(TheImportErrors())),
      ),
      equals(expected.map((error) => errorKey({ value: '', ...error })).sort()),
    ),
  );

/**
 * «خطای «…» برای خانه … (با مقدار «…») نشان داده شود» — the errors table has a row of that cell
 * with that reason (and value, when the step names one).
 */
export const EnsurePmPlanImportShowsAnError = (
  expected: ExpectedImportError,
): Task =>
  Task.where(
    d`#actor ensures the import shows the error "${expected.reason}" for ${expected.cell}`,
    Ensure.that(
      Question.about(
        d`whether the error "${expected.reason}" for ${expected.cell} is shown`,
        async (actor) =>
          (await actor.answer(TheImportErrors())).some(
            (row) =>
              row['خانه'] === expected.cell &&
              row['علت'] === expected.reason &&
              (expected.value === undefined ||
                asAValue(row['مقدار'] ?? '') === expected.value),
          ),
      ),
      isTrue(),
    ),
  );

const isTheRowOf =
  (maintenanceTask: string) =>
  (row: ListRow): boolean => {
    const { equipmentName, activityName } =
      theMaintenanceTaskNamed(maintenanceTask);
    return row['تجهیز'] === equipmentName && row['فعالیت'] === activityName;
  };

/** «تعویض روغن کمپرسور هوا "از قبل موجود" گزارش شود» */
export const EnsurePmPlanImportReportsAlreadyExisting = (
  maintenanceTask: string,
): Task =>
  Task.where(
    d`#actor ensures the import reports ${maintenanceTask} as already existing`,
    Ensure.that(
      Question.about(
        d`whether ${maintenanceTask} is reported as already existing`,
        async (actor) =>
          (await actor.answer(TheItemsAlreadyExisting())).some(
            isTheRowOf(maintenanceTask),
          ),
      ),
      isTrue(),
    ),
  );

/** «اختلاف دوره / اولین موعد تعویض روغن کمپرسور هوا گزارش شود» — and in nothing else. */
export const EnsurePmPlanImportReportsAConflict = (
  maintenanceTask: string,
  differences: PlanItemDifference[],
): Task =>
  Task.where(
    d`#actor ensures the import reports ${maintenanceTask} differing in ${differenceLabel(differences)}`,
    Ensure.that(
      Question.about(
        d`what the import reports ${maintenanceTask} differing in`,
        async (actor) =>
          (await actor.answer(TheImportConflicts()))
            .filter(isTheRowOf(maintenanceTask))
            .map((row) => row['اختلاف']),
      ),
      equals([differenceLabel(differences)]),
    ),
  );

// ---------------------------------------------------------------------------------------------
// What the import did — over the API
// ---------------------------------------------------------------------------------------------

/**
 * «هیچ برنامه ای ثبت نشده باشد» — no equipment of the scenario has an active plan row (the outline
 * that says it states no plan before the upload).
 */
export const EnsureNoPlanItemWasAdded = (): Interaction =>
  Interaction.where('#actor ensures no plan item was added', async (actor) => {
    const equipment = everyRegisteredEquipment();
    await Ensure.that(equipment.length > 0, isTrue()).performAs(actor);
    for (const { name } of equipment) {
      await EnsureNoActivityIsActiveInPmPlan(name).performAs(actor);
    }
  });
