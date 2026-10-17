import { d, Question, QuestionAdapter, Task, Wait } from '@serenity-js/core';
import { Ensure, equals } from '@serenity-js/assertions';
import { Click, isVisible, Scroll, Text } from '@serenity-js/web';
import { BomDashboardPage } from '../ui/bom-dashboard-page';
import { ViewBomDashboard } from './bom-dashboard-list';
import { fromRenderedNumber } from '../common/persian-digits';

/**
 * The per-product half of `bom-dashboard.feature` — covers the "انتخاب یک محصول از داشبورد"
 * rule and the three rules layered on top of it (per-line weight/description visibility,
 * per-analysis score visibility, score-desc ordering).
 *
 * Mirrors the split `screenplay/bom-reporting/` makes between its `bom-report-list.ts`
 * (page-locating tasks) and `bom-report-details.ts` (per-detail-dialog tasks): this module never
 * navigates to the dashboard on its own — it always starts from one of `ViewBomDashboard`'s
 * variants, the same way `bom-report-details.ts#OpenBomReportDetails` starts from
 * `ViewBomReportList.unfiltered()`.
 *
 * Every quantity the panel renders (weights, weight difference, score) goes through the frontend's
 * Persian-number pipe, so the questions here hand back `fromRenderedNumber` of it — plain Latin
 * notation, sign included — and the step definitions compare against the Gherkin literal as written.
 *
 * The "the per-product panel I just selected" problem is resolved by taking `productName`
 * explicitly: every `Ensure*` task is bound to a specific product, and every `Open*` task that
 * selects a product passes the same product name to the follow-up assertion. The step
 * definitions (`bom-dashboard.steps.ts`) thread that product name through, the same way
 * `bom-report-details.ts#OpenBomReportDetails` does.
 */

/** One line of a daily BOM as the dashboard shows it, quantities in plain Latin notation
 * (`fromRenderedNumber`) and the line keyed to the tracking number of the card it sits in. The
 * description is the card's, not the line's — the page shows it once per daily BOM, in the card's
 * header table — so every line of one card carries the same one. */
export interface DailyBomLine {
  trackingNumber: string;
  componentName: string;
  materialName: string;
  standardWeight: string;
  actualWeight: string;
  difference: string;
  description: string;
}

/** The lines table's column headers, as the page names them — see
 * `BomDashboardPage.cardLineHeaderCells`. The description is not among them: it lives in the
 * card's header table (`BomDashboardPage.cardDescriptionCell`). */
const LINE_COLUMNS = {
  componentName: 'نام جز',
  materialName: 'نام مواد اولیه',
  standardWeight: 'وزن استاندارد',
  actualWeight: 'وزن ثبت‌شده',
  difference: 'اختلاف وزن',
} as const;

/** Tracking-number cells from the per-product panel, in rendered (top-to-bottom, score-desc)
 * order. */
const TrackingNumberCellsInPanel = (
  productName: string,
): QuestionAdapter<string[]> =>
  Question.about(
    `the tracking number cells in ${productName}'s panel, in rendered order`,
    async (actor) =>
      actor.answer(
        Text.ofAll(BomDashboardPage.trackingNumberCellsInPanel(productName)),
      ),
  );

/** Same cells, sorted — for the set-membership claim "با شماره ردیابی «...»". */
const SortedTrackingNumberCellsInPanel = (
  productName: string,
): QuestionAdapter<string[]> =>
  Question.about(
    `the tracking number cells in ${productName}'s panel, sorted`,
    async (actor) => {
      const values = await actor.answer(
        TrackingNumberCellsInPanel(productName),
      );
      return [...values].sort();
    },
  );

/** The score of the first analysis rendered in the per-product panel, in plain Latin notation.
 * The score-visibility rule's `Given` registers exactly one analysis for its product, so the
 * first is the only one. */
const FirstDailyBomScoreInPanel = (
  productName: string,
): QuestionAdapter<string> =>
  Question.about(
    `the score of the first daily BOM in ${productName}'s panel`,
    async (actor) =>
      fromRenderedNumber(
        await actor.answer(
          Text.of(BomDashboardPage.scoreCellsInPanel(productName).first()),
        ),
      ),
  );

/**
 * Every line of every daily-BOM card in the per-product panel, card by card in rendered order.
 * Each line is read by column header rather than position — the value under «اختلاف وزن» is
 * whatever the page puts under the header it calls «اختلاف وزن» — and carries the tracking number
 * and description of its own card, read from that card's header table, so a line can never be
 * credited to the wrong analysis. A header the page does
 * not render fails loudly with the headers it does render.
 */
const DailyBomLinesInPanel = (
  productName: string,
): QuestionAdapter<DailyBomLine[]> =>
  Question.about(
    `the daily-BOM lines in ${productName}'s panel, in rendered order`,
    async (actor) => {
      const cards = await actor.answer(
        BomDashboardPage.dailyBomCardsInPanel(productName),
      );
      const lines: DailyBomLine[] = [];
      for (const card of cards) {
        const trackingNumber = await actor.answer(
          Text.of(BomDashboardPage.cardTrackingNumberCell().of(card)),
        );
        const description = (
          await actor.answer(
            Text.of(BomDashboardPage.cardDescriptionCell().of(card)),
          )
        ).trim();
        const headers = (
          await actor.answer(
            Text.ofAll(BomDashboardPage.cardLineHeaderCells().of(card)),
          )
        ).map((header) => header.trim());
        const columnIndex = (header: string): number => {
          const index = headers.indexOf(header);
          if (index === -1) {
            throw new Error(
              `The lines table of daily BOM "${trackingNumber}" has no "${header}" column ` +
                `(it has: ${headers.join(' | ')}).`,
            );
          }
          return index;
        };
        const rows = await actor.answer(
          BomDashboardPage.cardLineRows().of(card),
        );
        for (const row of rows) {
          const cells = (
            await actor.answer(
              Text.ofAll(BomDashboardPage.lineRowCells().of(row)),
            )
          ).map((cell) => cell.trim());
          const cell = (header: string): string =>
            cells[columnIndex(header)] ?? '';
          lines.push({
            trackingNumber: trackingNumber.trim(),
            componentName: cell(LINE_COLUMNS.componentName),
            materialName: cell(LINE_COLUMNS.materialName),
            standardWeight: fromRenderedNumber(
              cell(LINE_COLUMNS.standardWeight),
            ),
            actualWeight: fromRenderedNumber(cell(LINE_COLUMNS.actualWeight)),
            // The difference pill ends in visually hidden words giving its direction; they are not
            // part of the quantity.
            difference: fromRenderedNumber(
              cell(LINE_COLUMNS.difference).replace(
                /\s*(بیشتر از|کمتر از|برابر با) استاندارد$/,
                '',
              ),
            ),
            description,
          });
        }
      }
      return lines;
    },
  );

/** "نیکروش محصول ... را از داشبورد با بازه زمانی امروز انتخاب می کند" — the per-product selection
 * step from three of the feature's rules. Combines the dashboard's "today" range filter with the
 * click on the product's select button and waits for the per-product panel to render, since the
 * dispatch's API surface loads each product's daily-BOM list lazily on selection.
 *
 * The "with بازه زمانی امروز" wording is the feature's own shorthand for the
 * "1403/06/15 00:00" to "1403/06/16 00:00" range (the dashboard's own background comment confirms
 * the test clock is frozen to `1403/06/15`), so the literal from/to are passed straight through
 * the date-range control — exactly the way `ViewBomDashboard.filteredByDateRangeBetween` does,
 * no `parseJalaliDateTime` here either.
 *
 * `Scroll.to` before the visibility wait is load-bearing, not decorative: with the background's
 * real daily-BOM volume the panel renders taller than the default Playwright viewport (1280×720),
 * so its own centre point — what `isVisible()` hit-tests via `elementFromPoint` — lands below the
 * fold. Nothing is wrong with the panel; the actor just hasn't scrolled to it yet, exactly the
 * scenario `@serenity-js/web`'s own `Scroll.to` doc example describes ("an element … outside of
 * the visible area"). Without this, the wait times out no matter how long the budget, because the
 * element never satisfies an in-viewport hit-test until something scrolls to it. */
export const OpenProductDailyBomList = (productName: string): Task =>
  Task.where(
    d`#actor opens the daily BOM list for "${productName}" from the dashboard`,
    ViewBomDashboard.filteredByDateRangeBetween(
      '1403/06/15 00:00',
      '1403/06/16 00:00',
    ),
    Click.on(BomDashboardPage.productSelectButton(productName)),
    Scroll.to(BomDashboardPage.productPanel(productName)),
    Wait.until(BomDashboardPage.productPanel(productName), isVisible()),
  );

/** "نیکروش آن آنالیز روزانه را در داشبورد مشاهده می کند" — the score-visibility rule's own
 * "انتخاب" step, which doesn't name a product in the Gherkin (the rule's own `Given` registers
 * both product and BOM itself), so this overload takes the product name as a parameter from the
 * caller rather than the feature's own named product. Same `Scroll.to` reasoning as
 * `OpenProductDailyBomList` above — the panel can render below the fold. */
export const OpenThatDailyBomListInTheDashboard = (productName: string): Task =>
  Task.where(
    d`#actor opens that daily BOM's product list in the dashboard`,
    ViewBomDashboard.unfiltered(),
    Click.on(BomDashboardPage.productSelectButton(productName)),
    Scroll.to(BomDashboardPage.productPanel(productName)),
    Wait.until(BomDashboardPage.productPanel(productName), isVisible()),
  );

/** "انتظار می رود آنالیز های روزانه با شماره ردیابی «...» برای آن محصول نمایش داده شود" — a
 * set-membership claim; `EnsureDailyBomsShownInOrder` is what tests the score-desc order. */
export const EnsureDailyBomsWithTrackingNumbersShown = (
  productName: string,
  trackingNumbers: string[],
): Task =>
  Task.where(
    d`#actor ensures the daily BOMs in ${productName}'s panel are exactly: ${trackingNumbers.join('، ')}`,
    Ensure.that(
      SortedTrackingNumberCellsInPanel(productName),
      equals([...trackingNumbers].sort()),
    ),
  );

/** "انتظار می رود آنالیز های روزانه به ترتیب زیر بر اساس امتیاز نمایش داده شود" — the tracking
 * numbers in rendered order are exactly `trackingNumbers`. */
export const EnsureDailyBomsShownInOrder = (
  productName: string,
  trackingNumbers: string[],
): Task =>
  Task.where(
    d`#actor ensures the daily BOMs in ${productName}'s panel are shown in the expected order`,
    Ensure.that(
      TrackingNumberCellsInPanel(productName),
      equals(trackingNumbers),
    ),
  );

const lineSortKey = (line: DailyBomLine): string =>
  [line.trackingNumber, line.componentName, line.materialName].join('\u0000');

const sortLines = (lines: DailyBomLine[]): DailyBomLine[] =>
  [...lines].sort((a, b) => lineSortKey(a).localeCompare(lineSortKey(b)));

/** "انتظار می رود لیست شامل موارد زیر باشد" — every line of the panel, exactly. Both sides are
 * sorted by (tracking number, component, material) first: the rule is about what each line shows
 * (weights, difference, description), not the order lines interleave in — that order is the
 * score rule's business. */
export const EnsureDailyBomLinesAreExactly = (
  productName: string,
  expected: DailyBomLine[],
): Task =>
  Task.where(
    d`#actor ensures the per-line rows in ${productName}'s panel are exactly as expected`,
    Ensure.that(
      Question.about(
        `the daily-BOM lines in ${productName}'s panel, sorted by tracking number/component/material`,
        async (actor) =>
          sortLines(await actor.answer(DailyBomLinesInPanel(productName))),
      ),
      equals(sortLines(expected)),
    ),
  );

/** "انتظار می رود اختلاف وزن مواد اولیه «...» جز «...» برابر «...» نمایش داده شود" — the
 * difference shown on the (only) line for that component/material, signed, in plain Latin
 * notation. */
export const EnsureWeightDifferenceIs = (
  productName: string,
  componentName: string,
  materialName: string,
  difference: string,
): Task =>
  Task.where(
    d`#actor ensures the weight difference of "${materialName}" in "${componentName}" in ${productName}'s panel is "${difference}"`,
    Ensure.that(
      Question.about(
        `the weight difference of "${materialName}" in "${componentName}" in ${productName}'s panel`,
        async (actor) =>
          (await actor.answer(DailyBomLinesInPanel(productName)))
            .filter(
              (line) =>
                line.componentName === componentName &&
                line.materialName === materialName,
            )
            .map((line) => line.difference),
      ),
      equals([difference]),
    ),
  );

/** "انتظار می رود امتیاز آن آنالیز روزانه برابر «...» نمایش داده شود". */
export const EnsureDailyBomScoreIs = (
  productName: string,
  score: string,
): Task =>
  Task.where(
    d`#actor ensures the score of the first daily BOM in ${productName}'s panel is "${score}"`,
    Ensure.that(FirstDailyBomScoreInPanel(productName), equals(score)),
  );
