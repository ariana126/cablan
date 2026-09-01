import {
  Answerable,
  Interaction,
  Question,
  QuestionAdapter,
  Task,
  TakeNotes,
} from '@serenity-js/core';
import { PlaywrightPage } from '@serenity-js/playwright';
import { PageElement } from '@serenity-js/web';
import { readSheet } from 'read-excel-file/node';

/**
 * Generic, UI-agnostic mechanics for capturing a real browser file download triggered by clicking
 * a page element, and reading it back as a plain grid of display strings — reusable by any feature
 * area whose scenarios trigger a file download. Lives here, not in `screenplay/bom-reporting/`, for
 * the same reason `screenplay/common/problem-detail.ts` does: it's technical machinery with no
 * BOM-specific vocabulary of its own. First (and currently only) call site:
 * `screenplay/bom-reporting/bom-report-export.ts` (`exporting-bom.feature`);
 * `exporting-standard-bom.feature` is expected to reuse it once automated.
 */

export interface DownloadNotes {
  downloadedWorkbookGrid: string[][];
}

/** Every shape `read-excel-file` parses a cell into — deliberately NOT reused from the library's
 * own exported `CellValue` type, whose `Date` member is typed as the `Date` *constructor* rather
 * than a `Date` *instance* (a schema-parsing artefact of that library's own types, not a shape any
 * real cell value takes), which would make the `instanceof Date` check below untypeable. */
type ExportedCellValue = string | number | boolean | Date | null | undefined;

/** Renders a cell as a plain string, matching how a Gherkin `DataTable`'s own cells are always
 * strings. ASSUMPTION: no exported cell is ever a real spreadsheet date (this feature's own
 * "تاریخ و زمان ثبت" column is Jalali text, e.g. "1403/04/01 08:30", not a value Excel would
 * recognise as a date) — if a future export ever writes one, this needs its own Jalali-aware
 * formatting, the same way `screenplay/common/jalali-datetime.ts` exists for the reverse
 * direction. */
const cellToString = (value: ExportedCellValue): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
};

/**
 * Clicks `trigger` and races the click against the browser's own `download` event — the standard
 * Playwright pattern for capturing a download, since the event only fires once the click is
 * already in flight. Reads the downloaded file's bytes straight into memory
 * (`Download.createReadStream()`, never `Download.path()`/`saveAs()` — no temp file on disk to
 * clean up) and parses its first worksheet into a plain grid of display strings, stashed on the
 * acting actor's own notepad (`DownloadNotes`) for a following `Ensure*` task to read back.
 *
 * `PlaywrightPage.current().nativePage()` is what reaches the raw Playwright `Page` this suite's
 * own Screenplay model otherwise deliberately hides — there's no Serenity/JS-level "capture a
 * download" interaction to build this from, so dropping to the native driver here is a deliberate,
 * narrowly-scoped exception, not a precedent for skipping the Domain layer elsewhere.
 */
export const CaptureTheDownloadTriggeredBy = (
  trigger: Answerable<PageElement>,
): Task =>
  Task.where(
    '#actor triggers a file download and captures it',
    Interaction.where(
      '#actor clicks the download trigger and reads the resulting file',
      async (actor) => {
        const page = await actor.answer(PlaywrightPage.current());
        const nativePage = await page.nativePage();
        const element = await actor.answer(trigger);

        const [download] = await Promise.all([
          nativePage.waitForEvent('download'),
          element.click(),
        ]);

        const stream = await download.createReadStream();
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(chunk as Buffer);
        }
        const buffer = Buffer.concat(chunks);

        const rows = await readSheet(buffer);
        const grid = rows.map((row) =>
          row.map((cell) => cellToString(cell as ExportedCellValue)),
        );

        TakeNotes.as<TakeNotes<DownloadNotes>>(actor).notepad.set(
          'downloadedWorkbookGrid',
          grid,
        );
      },
    ),
  );

/** The grid captured by the most recent `CaptureTheDownloadTriggeredBy` — header row included, as
 * rendered order (top row first, left-to-right within each row). */
export const TheDownloadedWorkbookGrid = (): QuestionAdapter<string[][]> =>
  Question.about('the downloaded workbook grid', (actor): string[][] =>
    TakeNotes.as<TakeNotes<DownloadNotes>>(actor).notepad.get(
      'downloadedWorkbookGrid',
    ),
  );
