import { d, Question, QuestionAdapter, Task, Wait } from '@serenity-js/core';
import { Ensure, equals } from '@serenity-js/assertions';
import { Click, isVisible, Scroll, Text } from '@serenity-js/web';
import { BomDashboardPage } from '../ui/bom-dashboard-page';
import { ViewBomDashboard } from './bom-dashboard-list';

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
 * The "the per-product panel I just selected" problem is resolved by taking `productName`
 * explicitly: every `Ensure*` task is bound to a specific product, and every `Open*` task that
 * selects a product passes the same product name to the follow-up assertion. The step
 * definitions (`bom-dashboard.steps.ts`) thread that product name through, the same way
 * `bom-report-details.ts#OpenBomReportDetails` does.
 */

export interface DailyBomLine {
  componentName: string;
  materialName: string;
  actualWeight: string;
  description: string;
}

/** Order-number cells from the per-product panel, in rendered (top-to-bottom) order — the
 * order the dispatch's API surface itself prescribes ("Items are sorted by `score` desc"). Used
 * by `EnsureDailyBomsShownInOrder`, which asserts the rendered order is exactly `expected`. */
const OrderNumberCellsInPanel = (
  productName: string,
): QuestionAdapter<string[]> =>
  Question.about(
    `the order number cells in ${productName}'s panel, in rendered order`,
    async (actor) => {
      return actor.answer(
        Text.ofAll(BomDashboardPage.orderNumberCellsInPanel(productName)),
      );
    },
  );

/** Same cells, but sorted before comparison — what `EnsureDailyBomsWithOrderNumbersShown`
 * compares against, since the Gherkin's "ORD-5001, ORD-5002" is a set-membership claim, not an
 * order claim. Mirrors `bom-report-list.ts#SortedOrderNumberCells`. */
const SortedOrderNumberCellsInPanel = (
  productName: string,
): QuestionAdapter<string[]> =>
  Question.about(
    `the order number cells in ${productName}'s panel, sorted`,
    async (actor) => {
      const values = await actor.answer(OrderNumberCellsInPanel(productName));
      return [...values].sort();
    },
  );

/** The score of the first analysis rendered in the per-product panel — the score the
 * `EnsureDailyBomScoreIs` rule's `Then` step is interested in, since the panel lists analyses
 * in score-desc order (`{id, orderNumber, …, score}` from the dispatch's API surface, sorted by
 * `score` desc) and the score-visibility rule's `Given` registers exactly one analysis per
 * product. */
const FirstDailyBomScoreInPanel = (
  productName: string,
): QuestionAdapter<string> =>
  Question.about(
    `the score of the first daily BOM in ${productName}'s panel`,
    async (actor) => {
      return actor.answer(
        Text.of(BomDashboardPage.scoreCellsInPanel(productName).first()),
      );
    },
  );

/** Per-line (component/material/actual weight/description) rows inside the per-product panel —
 * one entry per rendered `<tr>` of the breakdown table, in the same order. Mirrors
 * `bom-report-details.ts#TheComponentDetailRows` in shape. The panel's parent analyses render
 * in score-desc order (per the API surface's "items sorted by score desc"), so the per-line
 * rows interleave across analyses in that same order — `EnsureDailyBomLinesAreExactly` sorts
 * before comparing, since the Gherkin's "لیست شامل موارد زیر باشد" is a set-membership claim
 * ("the list includes the following"), not an order claim. */
const DailyBomLinesInPanel = (
  productName: string,
): QuestionAdapter<DailyBomLine[]> =>
  Question.about(
    `the daily-BOM line rows in ${productName}'s panel, in rendered order`,
    async (actor) => {
      const componentNames = await actor.answer(
        Text.ofAll(BomDashboardPage.lineComponentNameCells(productName)),
      );
      const materialNames = await actor.answer(
        Text.ofAll(BomDashboardPage.lineMaterialNameCells(productName)),
      );
      const actualWeights = await actor.answer(
        Text.ofAll(BomDashboardPage.lineActualWeightCells(productName)),
      );
      const descriptions = await actor.answer(
        Text.ofAll(BomDashboardPage.lineDescriptionCells(productName)),
      );
      return componentNames.map((componentName, index) => ({
        componentName,
        materialName: materialNames[index] ?? '',
        actualWeight: actualWeights[index] ?? '',
        description: descriptions[index] ?? '',
      }));
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

/** "انتظار می رود آنالیز های روزانه با شماره سفارش «...» برای آن محصول نمایش داده شود" — a CSV
 * list, order-independent, since the dedicated ordering scenario (`EnsureDailyBomsShownInOrder`
 * below) is what actually tests the score-desc rendering order. The expected list is sorted
 * before comparison (the Gherkin's "ORD-5001, ORD-5002" is a set membership claim, not an order
 * claim) and the rendered cells are sorted identically — both so the equality holds regardless
 * of the order the page happens to render them in. Bound to `productName` explicitly so the
 * assertion reads the same panel the preceding `When` step opened. */
export const EnsureDailyBomsWithOrderNumbersShown = (
  productName: string,
  orderNumbers: string[],
): Task =>
  Task.where(
    d`#actor ensures the daily BOMs in ${productName}'s panel are exactly: ${orderNumbers.join('، ')}`,
    Ensure.that(
      SortedOrderNumberCellsInPanel(productName),
      equals([...orderNumbers].sort()),
    ),
  );

/** "انتظار می رود آنالیز های روزانه به ترتیب زیر بر اساس امتیاز نمایش داده شود" — the score-desc
 * ordering rule's assertion. Bound to `productName` the same way as
 * `EnsureDailyBomsWithOrderNumbersShown`; reading the order-number cells (which are aligned
 * 1:1 with the score cells) in rendered order is what the Gherkin's "به ترتیب زیر بر اساس
 * امتیاز" actually tests. */
export const EnsureDailyBomsShownInOrder = (
  productName: string,
  orderNumbers: string[],
): Task =>
  Task.where(
    d`#actor ensures the daily BOMs in ${productName}'s panel are shown in the expected order`,
    Ensure.that(OrderNumberCellsInPanel(productName), equals(orderNumbers)),
  );

/** "انتظار می رود لیست شامل موارد زیر باشد" — the per-line component/material/weight/description
 * visibility rule's assertion. Bound to `productName` like the two `Ensure*` tasks above. The
 * Gherkin's "لیست شامل موارد زیر باشد" is a set-membership claim ("the list includes the
 * following"), not an order claim; the panel's parent analyses render in score-desc order, so
 * the per-line rows interleave across analyses in that same order. Both sides are sorted by
 * (componentName, materialName, actualWeight) before comparison — `actualWeight` disambiguates
 * within a (component, material) pair, since each analysis carries a distinct weight for the
 * same material (the rule under test). */
export const EnsureDailyBomLinesAreExactly = (
  productName: string,
  expected: DailyBomLine[],
): Task => {
  const sortKey = (line: DailyBomLine): string =>
    `${line.componentName}|${line.materialName}|${line.actualWeight}`;
  const sortedExpected = [...expected].sort((a, b) =>
    sortKey(a).localeCompare(sortKey(b)),
  );
  return Task.where(
    d`#actor ensures the per-line rows in ${productName}'s panel are exactly as expected`,
    Ensure.that(
      Question.about(
        `the daily-BOM line rows in ${productName}'s panel, sorted by component/material/weight`,
        async (actor) => {
          const lines = await actor.answer(DailyBomLinesInPanel(productName));
          return [...lines].sort((a, b) =>
            sortKey(a).localeCompare(sortKey(b)),
          );
        },
      ),
      equals(sortedExpected),
    ),
  );
};

/** "انتظار می رود امتیاز آن آنالیز روزانه برابر «...» نمایش داده شود" — the score-visibility
 * rule's assertion. The panel lists analyses in score-desc order, so the score for the
 * *first* analysis rendered (index 0) is the one this rule expects to equal `score`; the
 * dashboard's own background only registers one analysis in this rule's `Given`, so index 0
 * is unambiguous. */
export const EnsureDailyBomScoreIs = (
  productName: string,
  score: string,
): Task =>
  Task.where(
    d`#actor ensures the score of the first daily BOM in ${productName}'s panel is "${score}"`,
    Ensure.that(FirstDailyBomScoreInPanel(productName), equals(score)),
  );
