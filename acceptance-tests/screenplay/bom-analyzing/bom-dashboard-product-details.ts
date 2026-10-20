import { d, Question, QuestionAdapter, Task, Wait } from '@serenity-js/core';
import { Ensure, equals } from '@serenity-js/assertions';
import { LastResponse, PostRequest, Send } from '@serenity-js/rest';
import { Click, isVisible, Scroll, Text } from '@serenity-js/web';
import { BomDashboardPage } from '../ui/bom-dashboard-page';
import { ViewBomDashboard } from './bom-dashboard-list';
import { fromRenderedNumber } from '../common/persian-digits';
import { parseJalaliDateTime } from '../common/jalali-datetime';
import { RegisteredProduct } from '../bom-registration/product-details';

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
 * Every quantity the panel renders (weights, weight difference) goes through the frontend's
 * Persian-number pipe, so the questions here hand back `fromRenderedNumber` of it — plain Latin
 * notation, sign included — and the step definitions compare against the Gherkin literal as written.
 *
 * **The score is answered through the API, not the page.** The dashboard stopped displaying a
 * per-analysis score (GitHub issue #38) — the panels are still rendered score-desc, but no «امتیاز»
 * appears anywhere on screen. The score rule is a backend calculation with no screen as its point,
 * so its `Then`s take the API door (`POST boms/dashboard/:productId/daily-boms`, which still returns
 * `score` per item, score-desc) — the "a backend rule stays on the API door even when phrased
 * actively" case in `acceptance-tests/CLAUDE.md`'s "Which door a step goes through". The `When`
 * before them still opens the dashboard in the browser; only the reading of the score moved.
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

/** The feature's "بازه زمانی امروز" — the background comment fixes the test clock on 1403/06/15.
 * Entered into the date-range control as written (`OpenProductDailyBomList`), and parsed with
 * `parseJalaliDateTime` for the API door — the same interpretation the fixtures froze the clock
 * with when they registered each daily BOM, so the API range selects exactly the rows the UI's
 * does. */
const TODAY = { from: '1403/06/15 00:00', to: '1403/06/16 00:00' } as const;

/** One daily BOM as `POST boms/dashboard/:productId/daily-boms` answers it — only the fields the
 * score rules read. */
interface ProductDailyBomItem {
  trackingNumber: string;
  score: number;
}

/** A daily BOM's tracking number and score, as the score-ordering rule's table lists them. */
export interface RankedDailyBom {
  trackingNumber: string;
  score: number;
}

/** Asks the backend for a product's daily BOMs — optionally within a Jalali range — the API door
 * of the score rules. The answer is read back with `DailyBomsOfTheLastResponse`. */
const RequestTheDailyBomsOf = (
  product: RegisteredProduct,
  range?: { from: string; to: string },
): Task =>
  Task.where(
    d`#actor requests the daily BOMs of ${product.name} from the dashboard API`,
    Send.a(
      PostRequest.to(`boms/dashboard/${product.id}/daily-boms`).with(
        range
          ? {
              from: parseJalaliDateTime(range.from).toISOString(),
              to: parseJalaliDateTime(range.to).toISOString(),
            }
          : {},
      ),
    ),
    Ensure.that(LastResponse.status(), equals(200)),
  );

/** The daily BOMs of the last `RequestTheDailyBomsOf`, in the order the backend answered — which
 * is score-desc by contract. */
const DailyBomsOfTheLastResponse = (): QuestionAdapter<RankedDailyBom[]> =>
  Question.about(
    'the tracking numbers and scores of the daily BOMs the dashboard API answered with',
    async (actor) =>
      (
        await actor.answer(
          LastResponse.body<{ items: ProductDailyBomItem[] }>(),
        )
      ).items.map(({ trackingNumber, score }) => ({ trackingNumber, score })),
  );

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

/**
 * The weight difference a «اختلاف وزن» cell shows, in plain Latin notation. The pill ends in
 * visually hidden words giving its direction; they are not part of the quantity.
 *
 * **An empty cell reads as "0".** The dashboard leaves the cell blank — no pill, no text — when a
 * line matches its standard weight exactly (GitHub issue #38), so the eye lands only on deviations.
 * Blank is how the page says "no deviation", and the rule's table writes that same fact as `0`;
 * mapping one to the other here keeps the Gherkin, which describes the business rule rather than
 * the page, unchanged. A non-zero difference still has to be rendered to match.
 */
const differenceShownIn = (cellText: string): string => {
  const quantity = cellText
    .replace(/\s*(بیشتر از|کمتر از|برابر با) استاندارد$/, '')
    .trim();
  return quantity === '' ? '0' : fromRenderedNumber(quantity);
};

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
            difference: differenceShownIn(cell(LINE_COLUMNS.difference)),
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
    ViewBomDashboard.filteredByDateRangeBetween(TODAY.from, TODAY.to),
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
 * set-membership claim; `EnsureDailyBomsRankedByScore` is what tests the score-desc order. */
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

/** "انتظار می رود آنالیز های روزانه به ترتیب زیر بر اساس امتیاز نمایش داده شود" — two facts,
 * each read through the door that can still show it. The page no longer displays a score, but it
 * still renders the panels score-desc, so the order of the tracking numbers on screen is asserted
 * there; the scores that justify that order, and the backend's own score-desc ranking, are asserted
 * through the API for the same "today" range the panel was opened with. */
export const EnsureDailyBomsRankedByScore = (
  product: RegisteredProduct,
  expected: RankedDailyBom[],
): Task =>
  Task.where(
    d`#actor ensures the daily BOMs of ${product.name} are ranked by score as expected`,
    Ensure.that(
      TrackingNumberCellsInPanel(product.name),
      equals(expected.map(({ trackingNumber }) => trackingNumber)),
    ),
    RequestTheDailyBomsOf(product, TODAY),
    Ensure.that(DailyBomsOfTheLastResponse(), equals(expected)),
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

/** "انتظار می رود امتیاز آن آنالیز روزانه برابر «...» نمایش داده شود" — answered through the API
 * (see the module comment: the page shows no score any more). The rule's `Given` registers exactly
 * one daily BOM for a fresh product, so the product's whole list is that one score; asserting the
 * list rather than its first item also catches a stray second analysis. */
export const EnsureDailyBomScoreIs = (
  product: RegisteredProduct,
  score: number,
): Task =>
  Task.where(
    d`#actor ensures the score of the daily BOM of ${product.name} is ${score}`,
    RequestTheDailyBomsOf(product),
    Ensure.that(
      Question.about(
        `the scores of ${product.name}'s daily BOMs`,
        async (actor) =>
          (await actor.answer(DailyBomsOfTheLastResponse())).map(
            ({ score: each }) => each,
          ),
      ),
      equals([score]),
    ),
  );
