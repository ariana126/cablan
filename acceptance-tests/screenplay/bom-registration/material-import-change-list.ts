import { d, Question, QuestionAdapter, Task } from '@serenity-js/core';
import { Ensure, equals, includes, isTrue, not } from '@serenity-js/assertions';
import { isVisible, Text } from '@serenity-js/web';
import { MaterialsPage } from '../ui/materials-page';
import { withLatinDigits } from '../common/persian-digits';

/**
 * What the change-list dialog shows the visitor (`importing-materials.feature`'s `Then`s after a
 * browser upload). Through the UI, asserting what the visitor reads: the Persian description of
 * each change and the Persian text of each row's errors — never an error code.
 */

/** The dialog's columns, by the header text the page shows — see `MaterialsPage.changeHeaderCells`. */
const COLUMNS = {
  row: 'ردیف',
  change: 'تغییر',
  errors: 'خطا',
} as const;

/** The Persian error texts the change list shows (`docs/superpowers/plans/2026-10-29-importing-materials.md`). */
export const ChangeListError = {
  nameRequired: 'اسم مواد اولیه خالی است',
  codeRequired: 'کد مواد اولیه خالی است',
  duplicateNameInFile: 'اسم مواد اولیه در اکسل تکراری است',
  duplicateCodeInFile: 'کد مواد اولیه در اکسل تکراری است',
  codeTaken: 'کد مواد اولیه تکراری است و متعلق به مواد اولیه دیگری است',
} as const;

export interface ChangeListRow {
  row: number;
  change: string;
  errors: string;
}

/**
 * Text as it reads, whatever the markup did to it: bidi isolation and direction marks removed
 * (Latin codes inside Persian sentences are a classic place for them), whitespace collapsed.
 */
const asRead = (text: string): string =>
  text
    .replace(/[‎‏‪-‮⁦-⁩]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Every row of the open change list, in rendered order, each read by column header. */
const TheChangeList = (): QuestionAdapter<ChangeListRow[]> =>
  Question.about('the change list', async (actor) => {
    const headers = (
      await actor.answer(Text.ofAll(MaterialsPage.changeHeaderCells()))
    ).map(asRead);
    const columnIndex = (header: string): number => {
      const index = headers.indexOf(header);
      if (index === -1) {
        throw new Error(
          `The change list has no "${header}" column (it has: ${headers.join(' | ')}).`,
        );
      }
      return index;
    };
    const rows = await actor.answer(MaterialsPage.changeRows());
    const read: ChangeListRow[] = [];
    for (const row of rows) {
      const cells = (
        await actor.answer(Text.ofAll(MaterialsPage.changeRowCells().of(row)))
      ).map(asRead);
      const cell = (header: string): string => cells[columnIndex(header)] ?? '';
      read.push({
        row: Number(withLatinDigits(cell(COLUMNS.row))),
        change: cell(COLUMNS.change),
        errors: cell(COLUMNS.errors),
      });
    }
    return read;
  });

const TheChangeDescriptions = (): QuestionAdapter<string[]> =>
  Question.about('the changes in the change list', async (actor) =>
    (await actor.answer(TheChangeList())).map((row) => row.change),
  );

const TheErrorsOfRow = (row: number): QuestionAdapter<string> =>
  Question.about(
    d`the errors of row ${row} in the change list`,
    async (actor) => {
      const found = (await actor.answer(TheChangeList())).find(
        (candidate) => candidate.row === row,
      );
      if (!found) {
        throw new Error(`The change list shows no row ${row}.`);
      }
      return found.errors;
    },
  );

const TheDialogSaysItIsEmpty = (): QuestionAdapter<boolean> =>
  Question.about('whether the change list says it is empty', async (actor) =>
    asRead(
      await actor.answer(Text.of(MaterialsPage.changeListDialog())),
    ).includes('تغییری وجود ندارد'),
  );

/** «لیست تغییرات فقط شامل «…» باشد» — exactly these changes, in this order. */
export const EnsureTheChangeListShowsOnly = (changes: string[]): Task =>
  Task.where(
    d`#actor ensures the change list shows only ${changes.join(' / ')}`,
    Ensure.that(TheChangeDescriptions(), equals(changes.map(asRead))),
  );

/** «لیست تغییرات خالی باشد» — no rows, and the dialog says so. */
export const EnsureTheChangeListIsEmpty = (): Task =>
  Task.where(
    '#actor ensures the change list is empty',
    Ensure.that(MaterialsPage.changeRows().count(), equals(0)),
    Ensure.that(TheDialogSaysItIsEmpty(), isTrue()),
  );

/** «ردیف(های) «…» در لیست تغییرات با خطای … مشخص شده باشد(ند)» — each row carries the error text. */
export const EnsureRowsMarkedWith = (rows: number[], error: string): Task =>
  Task.where(
    d`#actor ensures rows ${rows.join(', ')} of the change list are marked "${error}"`,
    ...rows.map((row) => Ensure.that(TheErrorsOfRow(row), includes(error))),
  );

/** «پیغام خطای ردیف «…» نشان داده شود» — after a refused confirmation the dialog is still open and
 * the row still carries its error. */
export const EnsureTheChangeListShowsAnErrorFor = (rows: number[]): Task =>
  Task.where(
    d`#actor ensures the change list shows an error for rows ${rows.join(', ')}`,
    Ensure.that(MaterialsPage.changeListDialog(), isVisible()),
    ...rows.map((row) => Ensure.that(TheErrorsOfRow(row), not(equals('')))),
  );
