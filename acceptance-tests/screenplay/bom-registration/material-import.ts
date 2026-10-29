import {
  Actor,
  actorCalled,
  d,
  Interaction,
  Question,
  QuestionAdapter,
  Task,
  Wait,
} from '@serenity-js/core';
import {
  Ensure,
  equals,
  isPresent,
  isTrue,
  not,
} from '@serenity-js/assertions';
import { LastResponse, PostRequest, Send } from '@serenity-js/rest';
import { Click, isVisible, Text } from '@serenity-js/web';
import { MaterialsPage } from '../ui/materials-page';
import { LocateMaterialsPage } from './materials-form';
import { ChooseFileThrough } from '../common/uploads';
import { LogInAsPersona } from '../common/personas';
import { keepingTheSpotlight } from '../common/spotlight';
import { taskDependingOn } from '../common/task-depending-on';
import {
  ACCOUNTING_EXCEL_FILE_NAME,
  ACCOUNTING_EXCEL_MIME_TYPE,
  AccountingExcelItem,
  AccountingExcelRow,
  accountingExcelFile,
  numberedAsInTheSpreadsheet,
} from './accounting-excel';
import { freshMaterialDetails } from './material-details';
import {
  MaterialSummary,
  TheMaterialList,
  ViewMaterialList,
} from './view-material-list';
import { noteTheMaterialsBefore } from './registered-materials';

/**
 * Domain layer for «بارگذاری مواد اولیه از اکسل نرم افزار حسابداری» (`importing-materials.feature`,
 * and the bulk-import preconditions of viewing-audit-log.feature). A visitor uploads the accounting
 * Excel, reads the change list the system draws from it, removes the rows they don't want and
 * confirms; nothing is written before the confirmation, and then all or nothing.
 *
 * Two doors, per acceptance-tests/CLAUDE.md:
 * - **the browser** (`…using`): `/materials`' «بارگذاری از اکسل» and the change-list dialog it
 *   opens — for the active `When`s, and for importing-materials' passive «اینکه … اکسلی بارگذاری
 *   کرده باشد که لیست تغییرات آن … است», whose following `When` removes rows from and confirms the
 *   dialog that upload left open (no API call can open it);
 * - **HTTP** (`…viaApiUsing`): `POST materials/import-preview` (multipart, field `file`) and
 *   `POST materials/imports` — for the «تلاش …» attempts and the audit-log preconditions.
 */

/** A row of the Excel, and what the Gherkin says it is meant to do. */
export type IntendedChange =
  'register' | 'changeCode' | 'rename' | 'erroneous' | 'any';

export interface PlannedExcelRow extends AccountingExcelRow {
  intended: IntendedChange;
}

/** One preview item, as `POST materials/import-preview` answers it. */
export interface MaterialImportChange {
  row: number;
  kind: 'register' | 'changeCode' | 'rename' | 'unchanged' | 'invalid';
  name: string;
  code: string;
  materialId: string | null;
  previousName: string | null;
  previousCode: string | null;
  errors: string[];
}

interface MaterialImportPreview {
  changes: MaterialImportChange[];
}

/**
 * The sheet most recently uploaded in this scenario, row-numbered — how a `Then` finds «ردیف «مسی»»
 * in the change list (by its spreadsheet row number) and how a `When` picks the rows to remove.
 * Overwritten by every upload, so it never outlives the scenario that set it.
 */
let theSheet: PlannedExcelRow[] = [];

export const theUploadedSheet = (): PlannedExcelRow[] => theSheet;

const planned = (
  items: AccountingExcelItem[],
  intended: IntendedChange[] = [],
): PlannedExcelRow[] =>
  numberedAsInTheSpreadsheet(items).map((row, index) => ({
    ...row,
    intended: intended[index] ?? 'any',
  }));

/** The spreadsheet row numbers of the rows a Gherkin step names — by name, or by code when the row
 * has no name («ردیف «A-1»» in «ردیف بدون نام کالا»). */
export const rowsNamed = (nameOrCode: string): number[] => {
  const rows = theSheet
    .filter(
      (row) =>
        row.name === nameOrCode || (row.name === '' && row.code === nameOrCode),
    )
    .map((row) => row.row);
  if (rows.length === 0) {
    throw new Error(
      `The uploaded sheet has no row named "${nameOrCode}" (it has: ` +
        `${theSheet.map((row) => `${row.row}: ${row.name}/${row.code}`).join(', ')}).`,
    );
  }
  return rows;
};

/** The first `count` rows the Gherkin introduced as new materials. */
export const firstNewMaterialRows = (count: number): number[] => {
  const rows = theSheet
    .filter((row) => row.intended === 'register')
    .slice(0, count)
    .map((row) => row.row);
  if (rows.length < count) {
    throw new Error(
      `The uploaded sheet introduces only ${rows.length} new materials, not ${count}.`,
    );
  }
  return rows;
};

/** The row the Gherkin introduced as the code change of `name`. */
export const codeChangeRowOf = (name: string): number => {
  const row = theSheet.find(
    (candidate) =>
      candidate.intended === 'changeCode' && candidate.name === name,
  );
  if (!row) {
    throw new Error(`The uploaded sheet has no code change of "${name}".`);
  }
  return row.row;
};

// ---------------------------------------------------------------------------------------------
// «… که لیست تغییرات آن … است» / «… که … را اعمال کرده است» — a change list described in words.
// ---------------------------------------------------------------------------------------------

interface DescribedRow {
  intended: IntendedChange;
  name: string;
  /** Absent for a rename: the code is the renamed material's, looked up at run time. */
  code?: string;
  renamedFrom?: string;
}

const CLAUSE =
  /(ثبت|تغییر کد|تغییر نام|ردیف خطادار) "([^"]*)" (?:با کد|به) "([^"]*)"|(\d+) مواد اولیه جدید/g;

const INTENDED_BY_VERB: Record<string, IntendedChange> = {
  ثبت: 'register',
  'تغییر کد': 'changeCode',
  'تغییر نام': 'rename',
  'ردیف خطادار': 'erroneous',
};

/**
 * Reads a change list the Gherkin describes in words — «ثبت "آلومینیوم" با کد "A-1"، تغییر کد "مسی"
 * به "M-201" و تغییر نام "برنج" به "برنج زرد"», «10 مواد اولیه جدید، …», «… و ردیف خطادار "مسی" با
 * کد "B-1"» — into the Excel rows that produce it, in the order stated. «N مواد اولیه جدید» are N
 * fresh materials. Anything left over besides the separators («،», «و») fails loudly, so a clause
 * this parser doesn't know can't be silently dropped.
 */
export const excelRowsDescribedAs = (description: string): DescribedRow[] => {
  const rows: DescribedRow[] = [];
  const leftover = description.replace(
    CLAUSE,
    (
      _match,
      verb?: string,
      first?: string,
      second?: string,
      count?: string,
    ) => {
      if (count !== undefined) {
        for (let i = 0; i < Number(count); i += 1) {
          const fresh = freshMaterialDetails();
          rows.push({
            intended: 'register',
            name: fresh.name,
            code: fresh.code,
          });
        }
      } else if (verb === 'تغییر نام') {
        rows.push({
          intended: 'rename',
          name: second ?? '',
          renamedFrom: first,
        });
      } else {
        rows.push({
          intended: INTENDED_BY_VERB[verb ?? ''],
          name: first ?? '',
          code: second ?? '',
        });
      }
      return ' ';
    },
  );
  const notUnderstood = leftover
    .split(/[\s،,]+/)
    .filter((word) => word !== '' && word !== 'و');
  if (notUnderstood.length > 0) {
    throw new Error(
      `Could not read the change list "${description}" — not understood: "${notUnderstood.join(' ')}".`,
    );
  }
  return rows;
};

/** Gives each renamed row the code of the material it renames, from the system's materials. */
const resolvedAgainst = (
  rows: DescribedRow[],
  materials: MaterialSummary[],
): AccountingExcelItem[] =>
  rows.map((row) => {
    if (row.code !== undefined) {
      return { name: row.name, code: row.code };
    }
    const renamed = materials.find((m) => m.name === row.renamedFrom);
    if (!renamed) {
      throw new Error(
        `Cannot rename "${row.renamedFrom}": no material by that name is registered.`,
      );
    }
    return { name: row.name, code: renamed.code ?? '' };
  });

/** The described rows as Excel items, renames resolved against the material list last viewed. */
const TheItemsDescribedBy = (
  described: DescribedRow[],
): QuestionAdapter<AccountingExcelItem[]> =>
  Question.about('the Excel rows the change list needs', async (actor) =>
    resolvedAgainst(described, await actor.answer(TheMaterialList())),
  );

// ---------------------------------------------------------------------------------------------
// The browser door
// ---------------------------------------------------------------------------------------------

const EMPTY_CHANGE_LIST = 'تغییری وجود ندارد';

/** True once the open change-list dialog shows either its rows or its empty state. */
const TheChangeListHasRendered = (): QuestionAdapter<boolean> =>
  Question.about('whether the change list has rendered', async (actor) => {
    const dialog = await actor.answer(MaterialsPage.changeListDialog());
    if (!(await dialog.isVisible())) {
      return false;
    }
    if ((await actor.answer(MaterialsPage.changeRows().count())) > 0) {
      return true;
    }
    return (await actor.answer(Text.of(MaterialsPage.changeListDialog())))
      .replace(/\s+/g, ' ')
      .includes(EMPTY_CHANGE_LIST);
  });

/** Whether the change list's «تایید» has been answered: the dialog closed, or it says why not. */
const TheChangeListHasBeenAnswered = (): QuestionAdapter<boolean> =>
  Question.about('whether the change list has been answered', async (actor) => {
    const dialog = await actor.answer(MaterialsPage.changeListDialog());
    if (!(await dialog.isVisible())) {
      return true;
    }
    // Present, not visible: the banner sits at the top of the scrolling content, which a removal
    // further down may have scrolled out of view (see `RemoveFromTheChangeList`). It is rendered
    // only when there is an error.
    const alert = await actor.answer(MaterialsPage.changeListAlert());
    return alert.isPresent();
  });

/** The sheet with every Gherkin row in it, remembered for the steps that follow. */
const RememberTheSheet = (sheet: PlannedExcelRow[]): Interaction =>
  Interaction.where('#actor remembers the uploaded sheet', () => {
    theSheet = sheet;
  });

const fileOf = (sheet: PlannedExcelRow[]) => ({
  name: ACCOUNTING_EXCEL_FILE_NAME,
  mimeType: ACCOUNTING_EXCEL_MIME_TYPE,
  buffer: Question.about('the accounting Excel', () =>
    accountingExcelFile(sheet.map(({ name, code }) => ({ name, code }))),
  ),
});

const multipartBodyOf = (sheet: PlannedExcelRow[]) =>
  Question.about('the accounting Excel, as a multipart form', async () => {
    const buffer = await accountingExcelFile(
      sheet.map(({ name, code }) => ({ name, code })),
    );
    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(buffer)], { type: ACCOUNTING_EXCEL_MIME_TYPE }),
      ACCOUNTING_EXCEL_FILE_NAME,
    );
    return form;
  });

const RememberThePreview = (): Interaction =>
  Interaction.where('#actor remembers the change list', async (actor) => {
    lastPreview = (
      await actor.answer(LastResponse.body<MaterialImportPreview>())
    ).changes;
  });

let lastPreview: MaterialImportChange[] = [];

/** The change list of the last upload through the API. */
export const theLastChangeList = (): MaterialImportChange[] => lastPreview;

export const UploadAccountingExcel = {
  /**
   * Uploads the sheet through `/materials`' «بارگذاری از اکسل» and waits for the change list it
   * draws to render — its rows, or its empty state «تغییری وجود ندارد».
   */
  using: (
    items: AccountingExcelItem[],
    intended: IntendedChange[] = [],
  ): Task => {
    const sheet = planned(items, intended);
    return Task.where(
      d`#actor uploads an accounting Excel of ${sheet.length} rows`,
      RememberTheSheet(sheet),
      LocateMaterialsPage(),
      Wait.until(MaterialsPage.importFromExcelButton(), isVisible()),
      ChooseFileThrough(MaterialsPage.importFromExcelButton(), fileOf(sheet)),
      Wait.until(TheChangeListHasRendered(), isTrue()),
    );
  },

  /**
   * The same, for a change list the Gherkin describes in words (`excelRowsDescribedAs`) — each row
   * remembered with what it is meant to do, so a following `When` can remove «2 مواد اولیه جدید»
   * or «تغییر کد "برنج"» by row number.
   */
  describedAs: (description: string): Task => {
    const described = excelRowsDescribedAs(description);
    return Task.where(
      d`#actor uploads an accounting Excel whose change list is: ${description}`,
      ViewMaterialList(),
      taskDependingOn(
        '#actor uploads it',
        TheItemsDescribedBy(described),
        (items) => [
          UploadAccountingExcel.using(
            items,
            described.map((row) => row.intended),
          ),
        ],
      ),
    );
  },

  /** `POST materials/import-preview` — stateless: it reads and compares, and writes nothing. */
  viaApiUsing: (items: AccountingExcelItem[]): Task => {
    const sheet = planned(items);
    return Task.where(
      d`#actor uploads an accounting Excel of ${sheet.length} rows (via API)`,
      RememberTheSheet(sheet),
      Send.a(
        PostRequest.to('materials/import-preview').with(multipartBodyOf(sheet)),
      ),
    );
  },
};

/** «… را از لیست تغییرات حذف …» — each row's own «حذف ردیف N» in the open dialog. */
//
// Waits for each button to be *present*, never *visible*: the dialog's content scrolls, and
// Serenity/JS's `isVisible()` also requires the element's centre to hit-test to itself
// (`document.elementFromPoint`, @serenity-js/web `scripts/isVisible`), which a row scrolled out of
// the dialog never does. `Click` is Playwright's own click, which scrolls the button into view and
// waits until it is actionable. The row's disappearance is what says the removal took effect.
export const RemoveFromTheChangeList = (rows: number[]): Task =>
  Task.where(
    d`#actor removes rows ${rows.join(', ')} from the change list`,
    ...rows.flatMap((row) => [
      Wait.until(MaterialsPage.removeChangeButton(row), isPresent()),
      Click.on(MaterialsPage.removeChangeButton(row)),
      Wait.until(MaterialsPage.removeChangeButton(row), not(isPresent())),
    ]),
  );

/** One kept row, as `POST materials/imports` takes it. */
export interface KeptRow {
  row: number;
  name: string;
  code: string;
}

let confirmedImports: string[] = [];

const RememberTheConfirmedImport = (): Interaction =>
  Interaction.where('#actor remembers the confirmed import', async (actor) => {
    const { id } = await actor.answer(LastResponse.body<{ id: string }>());
    confirmedImports.push(id);
  });

/** The id of the `ordinal`-th import the preconditions of this scenario confirmed (0 = first). */
export const theConfirmedImport = (ordinal: number | 'last'): string => {
  const id =
    ordinal === 'last'
      ? confirmedImports[confirmedImports.length - 1]
      : confirmedImports[ordinal];
  if (!id) {
    throw new Error(
      `No import ${String(ordinal)} has been confirmed in this scenario ` +
        `(${confirmedImports.length} were).`,
    );
  }
  return id;
};

export const ConfirmTheChangeList = {
  /** The dialog's «تایید», waiting until it closes or says why it can't. */
  using: (): Task =>
    Task.where(
      '#actor confirms the change list',
      Click.on(MaterialsPage.confirmChangeListButton()),
      Wait.until(TheChangeListHasBeenAnswered(), isTrue()),
    ),

  /** `POST materials/imports` with the rows kept. */
  viaApiUsing: (rows: KeptRow[]): Task =>
    Task.where(
      d`#actor confirms a change list of ${rows.length} rows (via API)`,
      Send.a(PostRequest.to('materials/imports').with({ rows })),
    ),
};

const keptRowOf = (change: MaterialImportChange): KeptRow => ({
  row: change.row,
  name: change.name,
  code: change.code,
});

// ---------------------------------------------------------------------------------------------
// Preconditions — the API door, performed by whoever the Gherkin names, spotlight untouched.
// ---------------------------------------------------------------------------------------------

/** Every row of the last API change list, except those `exclude` rules out. */
const KeepingTheChangeListExcept = (
  exclude: (change: MaterialImportChange) => boolean,
): QuestionAdapter<KeptRow[]> =>
  Question.about('the rows kept from the change list', () =>
    lastPreview.filter((change) => !exclude(change)).map(keptRowOf),
  );

const ConfirmAndRemember = (rows: QuestionAdapter<KeptRow[]>): Task =>
  Task.where(
    '#actor confirms the change list and remembers the import',
    Send.a(
      PostRequest.to('materials/imports').with(
        Question.about('the confirmation', async (actor) => ({
          rows: await actor.answer(rows),
        })),
      ),
    ),
    Ensure.that(LastResponse.status(), equals(201)),
    RememberTheConfirmedImport(),
  );

/** Uploads the described change list over the API as `importerName`, and remembers its preview. */
const UploadTheDescribedChangeList = (description: string): Task => {
  const described = excelRowsDescribedAs(description);
  return Task.where(
    d`#actor uploads an Excel whose change list is: ${description}`,
    ViewMaterialList(),
    taskDependingOn(
      '#actor uploads it',
      TheItemsDescribedBy(described),
      (items) => [
        UploadAccountingExcel.viaApiUsing(items),
        Ensure.that(LastResponse.status(), equals(200)),
        RememberThePreview(),
      ],
    ),
  );
};

/** Starts the scenario's record of confirmed imports afresh — every import precondition calls it
 * (or follows one that did), so no id outlives its scenario. */
const forgetConfirmedImports = (): void => {
  confirmedImports = [];
};

/** «{actor} اکسلی بارگذاری کرده باشد که لیست تغییرات آن … است» (the API door) */
export const uploadAsAPrecondition = (
  importerName: string,
  description: string,
): Promise<void> => {
  forgetConfirmedImports();
  return keepingTheSpotlight(() =>
    actorCalled(importerName).attemptsTo(
      LogInAsPersona(importerName),
      UploadTheDescribedChangeList(description),
    ),
  );
};

/** «{actor} ثبت «…» را از لیست تغییرات حذف و آن را تایید کرده باشد» — confirms the last API
 * upload's change list without the registration of `name`. */
export const confirmWithoutRegistrationAsAPrecondition = (
  importerName: string,
  name: string,
): Promise<void> =>
  keepingTheSpotlight(() =>
    actorCalled(importerName).attemptsTo(
      LogInAsPersona(importerName),
      ConfirmAndRemember(
        KeepingTheChangeListExcept(
          (change) => change.kind === 'register' && change.name === name,
        ),
      ),
    ),
  );

/** «{actor} اکسلی را بارگذاری و تایید کرده باشد که … را اعمال کرده است» — upload, keep every row,
 * confirm. `fresh` leaves earlier imports of the scenario on record (the «دو اکسل» precondition). */
export const importAsAPrecondition = (
  importerName: string,
  description: string,
  { fresh = true }: { fresh?: boolean } = {},
): Promise<void> => {
  if (fresh) {
    forgetConfirmedImports();
  }
  return keepingTheSpotlight(() =>
    actorCalled(importerName).attemptsTo(
      LogInAsPersona(importerName),
      UploadTheDescribedChangeList(description),
      ConfirmAndRemember(KeepingTheChangeListExcept(() => false)),
    ),
  );
};

// ---------------------------------------------------------------------------------------------
// The active `When`s — the browser door, after noting the materials for the `Then`s.
// ---------------------------------------------------------------------------------------------

/** «{actor} اکسلی با … بارگذاری می کند» */
export const uploadThroughTheBrowser = async (
  actor: Actor,
  items: AccountingExcelItem[],
): Promise<void> => {
  await noteTheMaterialsBefore('the change');
  await actor.attemptsTo(UploadAccountingExcel.using(items));
};

/** «{actor} اکسلی با … بارگذاری و تایید می کند» */
export const uploadAndConfirmThroughTheBrowser = async (
  actor: Actor,
  items: AccountingExcelItem[],
): Promise<void> => {
  await noteTheMaterialsBefore('the change');
  await actor.attemptsTo(
    UploadAccountingExcel.using(items),
    ConfirmTheChangeList.using(),
  );
};

/**
 * «{actor} … را از لیست تغییرات حذف و آن را تایید می کند» / «{actor} لیست تغییرات را تایید می کند»
 * — on the change list the actor's earlier upload left open.
 */
export const removeAndConfirmThroughTheBrowser = async (
  actor: Actor,
  rowsToRemove: number[],
): Promise<void> => {
  await noteTheMaterialsBefore('the change');
  await actor.attemptsTo(
    ...(rowsToRemove.length > 0 ? [RemoveFromTheChangeList(rowsToRemove)] : []),
    ConfirmTheChangeList.using(),
  );
};
