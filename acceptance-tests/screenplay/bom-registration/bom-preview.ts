import {
  d,
  Interaction,
  Question,
  QuestionAdapter,
  Task,
  Wait,
} from '@serenity-js/core';
import { Ensure, equals, isPresent, not } from '@serenity-js/assertions';
import { Click, isVisible, Text } from '@serenity-js/web';
import { BomsPage } from '../ui/boms-page';
import { LetTimePass } from '../common/clock';
import { fromRenderedNumber } from '../common/persian-digits';
import {
  differenceShownIn,
  directionShownIn,
} from '../common/weight-difference';
import {
  EnsureAuditEventsShownInOrder,
  ViewAuditLog,
} from '../audit-logging/view-audit-log';
import {
  NewBomDetails,
  rememberRegisteredBom,
  theLastRegisteredBom,
} from './bom-details';
import { RegisterBom } from './register-bom';
import { BomSummary, TheBomList, ViewBomList } from './view-bom-list';

/**
 * The daily BOM preview — «قانون: پس از ثبت آنالیز روزانه، پیش نمایش اختلاف وزن مواد اولیه آن با
 * آنالیز استاندارد به کاربر نشان داده می شود» (`registring-bom.feature`).
 *
 * The preview exists only in the browser, straight after a registration through the form, so every
 * task here starts from an open preview and nothing navigates: a reload would lose it. Its two
 * actions lead back into the ordinary flows — «تایید» just closes it, «ویرایش» opens the existing
 * edit form (`edit-bom.ts#EditBom.fromThePreview`).
 */

/** One line of the preview as the visitor reads it, every quantity in plain Latin notation, and
 * the direction as the visually hidden words of the difference pill name it. */
export interface PreviewedWeightDifference {
  componentName: string;
  materialName: string;
  weight: string;
  difference: string;
  direction: string;
}

/** The preview table's column headers, as the page names them — see
 * `BomsPage.previewHeaderCells`. The direction has no column of its own: it is part of the
 * «اختلاف وزن» cell. */
const COLUMNS = {
  componentName: 'نام جز',
  materialName: 'نام مواد اولیه',
  weight: 'وزن مواد اولیه',
  difference: 'اختلاف وزن',
} as const;

/** "پیش نمایش آن به او نشان داده شده باشد" — waits for the preview to open. */
export const EnsurePreviewShown = (): Task =>
  Task.where(
    '#actor ensures the daily BOM preview is shown',
    Wait.until(BomsPage.previewDialog(), isVisible()),
  );

/**
 * Every line of the open preview, in rendered order, each read by column header rather than
 * position. A header the page does not render fails loudly with the headers it does render.
 */
const ThePreviewedWeightDifferences = (): QuestionAdapter<
  PreviewedWeightDifference[]
> =>
  Question.about('the weight differences in the preview', async (actor) => {
    const headers = (
      await actor.answer(Text.ofAll(BomsPage.previewHeaderCells()))
    ).map((header) => header.trim());
    const columnIndex = (header: string): number => {
      const index = headers.indexOf(header);
      if (index === -1) {
        throw new Error(
          `The preview has no "${header}" column (it has: ${headers.join(' | ')}).`,
        );
      }
      return index;
    };
    const rows = await actor.answer(BomsPage.previewRows());
    const lines: PreviewedWeightDifference[] = [];
    for (const row of rows) {
      const cells = (
        await actor.answer(Text.ofAll(BomsPage.previewRowCells().of(row)))
      ).map((cell) => cell.trim());
      const cell = (header: string): string => cells[columnIndex(header)] ?? '';
      lines.push({
        componentName: cell(COLUMNS.componentName),
        materialName: cell(COLUMNS.materialName),
        weight: fromRenderedNumber(cell(COLUMNS.weight)),
        difference: differenceShownIn(cell(COLUMNS.difference)),
        direction: directionShownIn(cell(COLUMNS.difference)),
      });
    }
    return lines;
  });

const byComponentAndMaterial = (
  a: PreviewedWeightDifference,
  b: PreviewedWeightDifference,
): number =>
  `${a.componentName}|${a.materialName}`.localeCompare(
    `${b.componentName}|${b.materialName}`,
  );

/** The same lines, sorted — the rule is about each line's difference, not about their order. */
const ThePreviewedWeightDifferencesSorted = (): QuestionAdapter<
  PreviewedWeightDifference[]
> =>
  Question.about(
    'the weight differences in the preview, sorted',
    async (actor) =>
      [...(await actor.answer(ThePreviewedWeightDifferences()))].sort(
        byComponentAndMaterial,
      ),
  );

/**
 * "پیش نمایش اختلاف وزن زیر به {actor} نشان داده شود" — the preview is open and lists exactly the
 * expected lines. Waits for the row count first: the dialog opens before its lines have loaded.
 */
export const EnsurePreviewShows = (
  expected: PreviewedWeightDifference[],
): Task =>
  Task.where(
    '#actor ensures the preview shows the expected weight differences',
    EnsurePreviewShown(),
    Wait.until(BomsPage.previewRows().count(), equals(expected.length)),
    Ensure.that(
      ThePreviewedWeightDifferencesSorted(),
      equals([...expected].sort(byComponentAndMaterial)),
    ),
  );

/** "{actor} پیش نمایش را تایید می کند" */
export const ConfirmThePreview = (): Task =>
  Task.where(
    '#actor confirms the daily BOM preview',
    Click.on(BomsPage.previewConfirmButton()),
  );

/** "پیش نمایش بسته شده باشد" — through the UI: the dialog is gone. */
export const EnsurePreviewClosed = (): Task =>
  Task.where(
    '#actor ensures the daily BOM preview was closed',
    Wait.until(BomsPage.previewDialog(), not(isPresent())),
  );

/** The daily BOM as `GET /boms` reported it right after it was registered — what
 * `EnsureBomUnchangedSinceRegistration` compares against. */
let registeredBomAsItWas: BomSummary | undefined;

/**
 * Reads the just-registered daily BOM back from `GET /boms` by its order number, and remembers it:
 * as "the last registered daily BOM" (`bom-details.ts`) for the steps that edit it or check it was
 * not edited, and as a snapshot for `EnsureBomUnchangedSinceRegistration`. A UI registration never
 * hands the suite the new id, so this is how it learns it.
 */
const RememberTheBomRegisteredWithOrderNumber = (
  standardBomMiCode: string,
  orderNumber: string,
): Task =>
  Task.where(
    d`#actor remembers the daily BOM registered with order number "${orderNumber}"`,
    ViewBomList(),
    Interaction.where(
      '#actor remembers the registered daily BOM',
      async (actor) => {
        const found = (await actor.answer(TheBomList())).find(
          (bom) => bom.orderNumber === orderNumber,
        );
        if (!found) {
          throw new Error(
            `No daily BOM with order number "${orderNumber}" was found after registering it.`,
          );
        }
        registeredBomAsItWas = found;
        rememberRegisteredBom({
          id: found.id,
          standardBomId: found.standardBomId,
          standardBomMiCode,
          orderNumber: found.orderNumber,
          trackingNumber: found.trackingNumber,
        });
      },
    ),
  );

/**
 * «اینکه {actor} آنالیز روزانه جدیدی برای کد MI ... ثبت کرده و پیش نمایش آن به او نشان داده شده
 * باشد» — passive, yet through the browser: the preview it leaves open exists nowhere else. Registers
 * through the form, waits for the preview, then learns and remembers what was registered.
 *
 * Ends by letting a minute pass on the system clock, so anything done from the preview is stamped
 * strictly after the registration — otherwise the frozen test clock gives both audit entries the
 * same instant, and "registered, then edited" has no observable order. The browser's own clock is
 * not moved (`acceptance-tests/CLAUDE.md`, "Time"), which is harmless here: an open session lasts
 * an hour.
 */
export const RegisterBomAndSeeItsPreview = (
  standardBom: { id: string; miCode: string },
  details: Pick<
    NewBomDetails,
    'orderNumber' | 'trackingNumber' | 'description'
  >,
): Task =>
  Task.where(
    d`#actor registers a new daily BOM for standard BOM MI code "${standardBom.miCode}" and sees its preview`,
    RegisterBom.using(standardBom, details),
    EnsurePreviewShown(),
    RememberTheBomRegisteredWithOrderNumber(
      standardBom.miCode,
      details.orderNumber,
    ),
    LetTimePass(60_000),
  );

const TheRegisteredBomNow = (
  id: string,
): QuestionAdapter<BomSummary | undefined> =>
  Question.about(`daily BOM ${id} as the system holds it now`, async (actor) =>
    (await actor.answer(TheBomList())).find((bom) => bom.id === id),
  );

/** "آنالیز روزانه بدون تغییر در سیستم ثبت شده باشد" — still there, and identical to what was read
 * back right after it was registered. Through the API: confirming changes nothing on screen. */
export const EnsureBomUnchangedSinceRegistration = (): Task => {
  const target = theLastRegisteredBom();
  return Task.where(
    d`#actor ensures daily BOM "${target.orderNumber}" is registered unchanged`,
    ViewBomList(),
    Ensure.that(TheRegisteredBomNow(target.id), equals(registeredBomAsItWas)),
  );
};

/**
 * "رویداد ثبت و سپس رویداد ویرایش آن آنالیز روزانه در رویدادهای سیستم دیده شود" — the audit log,
 * filtered to this daily BOM, holds its registration and then its edit, both by `actorName`. The
 * log lists newest first, so the edit leads. Asked by whoever performs this task — an actor
 * allowed to read the audit log.
 */
export const EnsureRegisteredThenEditedInTheAuditLog = (
  actorName: string,
): Task => {
  const target = theLastRegisteredBom();
  return Task.where(
    d`#actor ensures daily BOM "${target.orderNumber}" was registered and then edited, per the audit log`,
    ViewAuditLog.viaApiUsing({ recordId: target.id }),
    EnsureAuditEventsShownInOrder([
      { actorName, recordType: 'Bom', recordId: target.id, action: 'Edited' },
      {
        actorName,
        recordType: 'Bom',
        recordId: target.id,
        action: 'Registered',
      },
    ]),
  );
};
