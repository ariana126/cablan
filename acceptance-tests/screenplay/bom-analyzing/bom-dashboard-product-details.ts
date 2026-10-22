import {
  d,
  Interaction,
  Question,
  QuestionAdapter,
  Task,
  Wait,
} from '@serenity-js/core';
import { Ensure, equals, isPresent, not } from '@serenity-js/assertions';
import { LastResponse, PostRequest, Send } from '@serenity-js/rest';
import { Clear, Click, Enter, isVisible, Scroll, Text } from '@serenity-js/web';
import { BomDashboardPage } from '../ui/bom-dashboard-page';
import { ViewBomDashboard } from './bom-dashboard-list';
import { fromRenderedNumber } from '../common/persian-digits';
import { differenceShownIn } from '../common/weight-difference';
import { parseJalaliDateTime } from '../common/jalali-datetime';
import {
  RegisteredProduct,
  theProductRegisteredWithName,
} from '../bom-registration/product-details';
import { theDashboardProductNameOf } from './bom-dashboard-fixtures';

/**
 * The per-product half of `bom-dashboard.feature` — covers the "انتخاب یک محصول از داشبورد"
 * rule and the rules layered on top of it (per-line weight, standard weight, weight difference and
 * description visibility, approval
 * status/approver visibility and their Excel-style filter, the inline weight edit, the description
 * edit dialog, per-analysis
 * score visibility, score-desc ordering). Approving and revoking from the dashboard live with the
 * rest of the approval vocabulary, in `daily-bom-approval.ts`.
 *
 * Mirrors the split `screenplay/bom-reporting/` makes between its `bom-report-list.ts`
 * (page-locating tasks) and `bom-report-details.ts` (per-detail-dialog tasks): this module never
 * navigates to the dashboard on its own — it always starts from one of `ViewBomDashboard`'s
 * variants, the same way `bom-report-details.ts#OpenBomReportDetails` starts from
 * `ViewBomReportList.unfiltered()`.
 *
 * Every quantity the panel renders (the weights) goes through the frontend's
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

/** One line of a daily BOM as the dashboard shows it, every quantity in plain Latin notation
 * (`fromRenderedNumber`) and the line keyed to the order number of the card it sits in. A zero
 * difference reads "0" here although the page leaves its cell blank (`differenceShownIn`). The
 * description is the card's, not the line's — the page shows it once per daily BOM, in the card's
 * header table — so every line of one card carries the same one. */
export interface DailyBomLine {
  orderNumber: string;
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
  orderNumber: string;
  score: number;
}

/** A daily BOM's order number and score, as the score-ordering rule's table lists them. */
export interface RankedDailyBom {
  orderNumber: string;
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
    'the order numbers and scores of the daily BOMs the dashboard API answered with',
    async (actor) =>
      (
        await actor.answer(
          LastResponse.body<{ items: ProductDailyBomItem[] }>(),
        )
      ).items.map(({ orderNumber, score }) => ({ orderNumber, score })),
  );

/** Order-number cells from the per-product panel, in rendered (top-to-bottom, score-desc)
 * order. */
const OrderNumberCellsInPanel = (
  productName: string,
): QuestionAdapter<string[]> =>
  Question.about(
    `the order number cells in ${productName}'s panel, in rendered order`,
    async (actor) =>
      (
        await actor.answer(
          Text.ofAll(BomDashboardPage.orderNumberCellsInPanel(productName)),
        )
      ).map((cell) => cell.trim()),
  );

/** Same cells, sorted — for the set-membership claim "با شماره سفارش «...»". */
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

/**
 * Every line of every daily-BOM card in the per-product panel, card by card in rendered order.
 * Each line is read by column header rather than position — the value under «اختلاف وزن» is
 * whatever the page puts under the header it calls that — and carries the order number and
 * description of its own card, read from that card's header table, so a line can never be
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
        const orderNumber = (
          await actor.answer(
            Text.of(BomDashboardPage.cardOrderNumberCell().of(card)),
          )
        ).trim();
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
              `The lines table of daily BOM "${orderNumber}" has no "${header}" column ` +
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
            orderNumber,
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
    RememberTheProductInFocus(productName),
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

/** "انتظار می رود آنالیز های روزانه با شماره سفارش «...» برای آن محصول نمایش داده شود", and the
 * column filter's "فقط آنالیز های روزانه با شماره سفارش «...» نمایش داده شود" — a set-membership
 * claim; `EnsureDailyBomsRankedByScore` is what tests the score-desc order. */
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

/** "انتظار می رود آنالیز های روزانه به ترتیب زیر بر اساس امتیاز نمایش داده شود" — two facts,
 * each read through the door that can still show it. The page no longer displays a score, but it
 * still renders the panels score-desc, so the order of the order numbers on screen is asserted
 * there; the scores that justify that order, and the backend's own score-desc ranking, are asserted
 * through the API for the same "today" range the panel was opened with. */
export const EnsureDailyBomsRankedByScore = (
  product: RegisteredProduct,
  expected: RankedDailyBom[],
): Task =>
  Task.where(
    d`#actor ensures the daily BOMs of ${product.name} are ranked by score as expected`,
    Ensure.that(
      OrderNumberCellsInPanel(product.name),
      equals(expected.map(({ orderNumber }) => orderNumber)),
    ),
    RequestTheDailyBomsOf(product, TODAY),
    Ensure.that(DailyBomsOfTheLastResponse(), equals(expected)),
  );

const lineSortKey = (line: DailyBomLine): string =>
  [line.orderNumber, line.componentName, line.materialName].join('\u0000');

const sortLines = (lines: DailyBomLine[]): DailyBomLine[] =>
  [...lines].sort((a, b) => lineSortKey(a).localeCompare(lineSortKey(b)));

/** "انتظار می رود لیست شامل موارد زیر باشد" — every line of the panel, exactly. Both sides are
 * sorted by (order number, component, material) first: the rule is about what each line shows
 * (weights, difference, description), not the order lines interleave in — that order is the score rule's
 * business. */
export const EnsureDailyBomLinesAreExactly = (
  productName: string,
  expected: DailyBomLine[],
): Task =>
  Task.where(
    d`#actor ensures the per-line rows in ${productName}'s panel are exactly as expected`,
    Ensure.that(
      Question.about(
        `the daily-BOM lines in ${productName}'s panel, sorted by order number/component/material`,
        async (actor) =>
          sortLines(await actor.answer(DailyBomLinesInPanel(productName))),
      ),
      equals(sortLines(expected)),
    ),
  );

/** "انتظار می رود اختلاف وزن مواد اولیه «...» جز «...» برابر «...» نمایش داده شود" — the one line
 * of that component and material in the product's panel, read the same way as the list's
 * «اختلاف وزن» column (`differenceShownIn`). Asserting the list of matching lines rather than its
 * first item also catches a missing line or a stray second one. */
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

/**
 * The product whose panel the scenario last opened — "آن محصول" in the column-filter step, and the
 * panel the shared order-number and approval `Then`s read (`step-definitions/common.steps.ts`).
 * Set as `OpenProductDailyBomList` runs, so it always names the panel actually on screen.
 */
let productInFocus: string | undefined;

const RememberTheProductInFocus = (productName: string): Interaction =>
  Interaction.where(d`#actor keeps ${productName} in focus`, () => {
    productInFocus = productName;
  });

export const theProductInFocusOnTheDashboard = (): string => {
  if (!productInFocus) {
    throw new Error(
      'No product panel has been opened on the dashboard yet — expected a preceding "محصول ... ' +
        'را از داشبورد با بازه زمانی امروز انتخاب" step.',
    );
  }
  return productInFocus;
};

/**
 * The daily BOM a dashboard step last acted on — "آن آنالیز روزانه" in the «از داشبورد» `Then`s.
 * Its product follows from the background (`theDashboardProductNameOf`).
 */
let dashboardDailyBomInFocus: string | undefined;

const rememberTheDashboardDailyBomInFocus = (
  orderNumber: string,
): Interaction =>
  Interaction.where(d`#actor keeps daily BOM "${orderNumber}" in focus`, () => {
    dashboardDailyBomInFocus = orderNumber;
  });

const theDashboardDailyBomInFocus = (): string => {
  if (!dashboardDailyBomInFocus) {
    throw new Error(
      'No daily BOM has been acted on from the dashboard yet — expected a preceding «از داشبورد» ' +
        'step.',
    );
  }
  return dashboardDailyBomInFocus;
};

/** One daily BOM's approval as a dashboard card or a report row shows it: «تایید شده» /
 * «تایید نشده», and the approver's name or «-». */
export interface ShownApproval {
  orderNumber: string;
  approvalStatus: string;
  approvedBy: string;
}

const byOrderNumber = (a: ShownApproval, b: ShownApproval): number =>
  a.orderNumber.localeCompare(b.orderNumber);

/** Every card's approval in a product's panel. */
const DailyBomApprovalsInPanel = (
  productName: string,
): QuestionAdapter<ShownApproval[]> =>
  Question.about(
    `the approval of every daily BOM in ${productName}'s panel`,
    async (actor) => {
      const cards = await actor.answer(
        BomDashboardPage.dailyBomCardsInPanel(productName),
      );
      const approvals: ShownApproval[] = [];
      for (const card of cards) {
        const read = async (
          cell: ReturnType<typeof BomDashboardPage.cardOrderNumberCell>,
        ) => (await actor.answer(Text.of(cell.of(card)))).trim();
        approvals.push({
          orderNumber: await read(BomDashboardPage.cardOrderNumberCell()),
          approvalStatus: await read(BomDashboardPage.cardApprovalStatusCell()),
          approvedBy: await read(BomDashboardPage.cardApproverCell()),
        });
      }
      return approvals.sort(byOrderNumber);
    },
  );

/** "انتظار می رود وضعیت تایید آنالیز های روزانه به صورت زیر نمایش داده شود" (dashboard branch) —
 * order-independent: the rule is about what each card says, the order is the score rule's. */
export const EnsureDailyBomApprovalsShownInPanel = (
  productName: string,
  expected: ShownApproval[],
): Task =>
  Task.where(
    d`#actor ensures the approvals shown in ${productName}'s panel are as expected`,
    Ensure.that(
      DailyBomApprovalsInPanel(productName),
      equals([...expected].sort(byOrderNumber)),
    ),
  );

/** "انتظار می رود وضعیت آن آنالیز روزانه در داشبورد «...» و تایید کننده آن «...» نمایش داده شود"
 * and "... و بدون تایید کننده ..." — the card of the daily BOM last acted on from the dashboard.
 * `approvedBy` is what the card shows: a name, or «-». */
export const EnsureTheDashboardShowsApproval = (
  approvalStatus: string,
  approvedBy: string,
): Task => {
  const orderNumber = theDashboardDailyBomInFocus();
  const card = BomDashboardPage.dailyBomCard(
    theDashboardProductNameOf(orderNumber),
    orderNumber,
  );
  return Task.where(
    d`#actor ensures the dashboard shows daily BOM "${orderNumber}" as "${approvalStatus}" by "${approvedBy}"`,
    Ensure.that(
      Text.of(BomDashboardPage.cardApprovalStatusCell().of(card)).trim(),
      equals(approvalStatus),
    ),
    Ensure.that(
      Text.of(BomDashboardPage.cardApproverCell().of(card)).trim(),
      equals(approvedBy),
    ),
  );
};

/** "لیست آنالیز های روزانه آن محصول را با انتخاب مقادیر «...» برای فیلتر «...» مشاهده می کند" —
 * the panel's Excel-style column filter: open it, clear every value, tick exactly `values`, apply,
 * and wait for the dialog to close (the filter is client-side, so its closing is the answer). */
export const FilterTheProductDailyBomList = {
  bySelectingValuesFor: (
    productName: string,
    field: string,
    values: string[],
  ): Task =>
    Task.where(
      d`#actor filters ${productName}'s daily BOMs by "${field}" to just ${values.join('، ')}`,
      Click.on(BomDashboardPage.panelColumnFilterButton(productName, field)),
      Click.on(BomDashboardPage.filterSelectAllCheckbox()),
      ...values.map((value) =>
        Click.on(BomDashboardPage.filterValueCheckbox(value)),
      ),
      Click.on(BomDashboardPage.applyFilterButton()),
      Wait.until(BomDashboardPage.applyFilterButton(), not(isVisible())),
    ),
};

/**
 * Opens the product panel a dashboard daily BOM sits in, today's range, and waits for its card —
 * the first half of every «از داشبورد» action on one daily BOM (edit a weight, edit the
 * description, approve, revoke), which also makes it "آن آنالیز روزانه" for the `Then`s after.
 * The product is the one the dashboard background registered that order number under.
 */
export const LocateTheDailyBomCardInTheDashboard = (
  orderNumber: string,
): Task => {
  const card = theDashboardCardOf(orderNumber);
  return Task.where(
    d`#actor locates daily BOM "${orderNumber}" on the dashboard`,
    OpenProductDailyBomList(theDashboardProductNameOf(orderNumber)),
    Scroll.to(card),
    Wait.until(card, isVisible()),
    rememberTheDashboardDailyBomInFocus(orderNumber),
  );
};

/** The card of the daily BOM `orderNumber`, in the panel of the product it was registered under. */
const theDashboardCardOf = (orderNumber: string) =>
  BomDashboardPage.dailyBomCard(
    theDashboardProductNameOf(orderNumber),
    orderNumber,
  );

/**
 * "وزن مواد اولیه «...» جز «...» در آنالیز روزانه با شماره سفارش «...» را از داشبورد به «...» تغییر
 * می دهد" — opens that daily BOM's card in today's panel, edits the one line's weight inline and
 * saves, waiting for the editor to close: the sign the save has been answered.
 */
export const ChangeMaterialWeight = {
  fromTheDashboard: (
    orderNumber: string,
    componentName: string,
    materialName: string,
    weight: string,
  ): Task => {
    const card = theDashboardCardOf(orderNumber);
    const weightInput = BomDashboardPage.cardWeightInput(
      componentName,
      materialName,
    ).of(card);
    return Task.where(
      d`#actor changes the weight of "${materialName}" in "${componentName}" of daily BOM "${orderNumber}" to ${weight} from the dashboard`,
      LocateTheDailyBomCardInTheDashboard(orderNumber),
      Click.on(
        BomDashboardPage.cardEditWeightButton(componentName, materialName).of(
          card,
        ),
      ),
      Wait.until(weightInput, isVisible()),
      Enter.theValue(weight).into(weightInput),
      Click.on(BomDashboardPage.cardSaveWeightButton().of(card)),
      Wait.until(weightInput, not(isPresent())),
    );
  },
};

/**
 * "توضیحات آنالیز روزانه با شماره سفارش «...» را از داشبورد به «...» تغییر می دهد" — opens that
 * daily BOM's card in today's panel, opens its edit-description dialog, replaces the text and
 * saves, waiting for the dialog to close: the sign the save has been answered, and what makes the
 * cards reachable by role again (the open dialog leaves the page `aria-hidden`).
 */
export const ChangeDailyBomDescription = {
  fromTheDashboard: (orderNumber: string, description: string): Task => {
    const field = BomDashboardPage.descriptionDialogField();
    return Task.where(
      d`#actor changes the description of daily BOM "${orderNumber}" to "${description}" from the dashboard`,
      LocateTheDailyBomCardInTheDashboard(orderNumber),
      Click.on(
        BomDashboardPage.cardEditDescriptionButton().of(
          theDashboardCardOf(orderNumber),
        ),
      ),
      Wait.until(field, isVisible()),
      Clear.theValueOf(field),
      Enter.theValue(description).into(field),
      Click.on(BomDashboardPage.descriptionDialogSaveButton()),
      Wait.until(BomDashboardPage.descriptionDialog(), not(isPresent())),
    );
  },
};

/**
 * "انتظار می رود توضیحات آن آنالیز روزانه در داشبورد «...» نمایش داده شود" — what the card of the
 * daily BOM last acted on from the dashboard shows as its description. `Ensure.eventually`, not
 * `Ensure.that`: the page re-reads the list only once the dialog has closed, so the card can still
 * show the old text for a moment; a description that never arrives still fails, on timeout.
 */
export const EnsureTheDashboardShowsDescription = (
  description: string,
): Task => {
  const orderNumber = theDashboardDailyBomInFocus();
  return Task.where(
    d`#actor ensures the dashboard shows "${description}" as the description of daily BOM "${orderNumber}"`,
    Ensure.eventually(
      Text.of(
        BomDashboardPage.cardDescriptionCell().of(
          theDashboardCardOf(orderNumber),
        ),
      ).trim(),
      equals(description),
    ),
  );
};

/** "انتظار می رود امتیاز آن آنالیز روزانه در داشبورد برابر «...» نمایش داده شود" — the daily BOM
 * last acted on from the dashboard. Read through the API for the same reason the other score
 * `Then`s are: the page shows no score (see the module comment). */
export const EnsureTheDashboardScoreIs = (score: number): Task => {
  const orderNumber = theDashboardDailyBomInFocus();
  const product = theProductRegisteredWithName(
    theDashboardProductNameOf(orderNumber),
  );
  return Task.where(
    d`#actor ensures the dashboard scores daily BOM "${orderNumber}" at ${score}`,
    RequestTheDailyBomsOf(product, TODAY),
    Ensure.that(
      Question.about(`the score of daily BOM "${orderNumber}"`, async (actor) =>
        (await actor.answer(DailyBomsOfTheLastResponse()))
          .filter((item) => item.orderNumber === orderNumber)
          .map((item) => item.score),
      ),
      equals([score]),
    ),
  );
};
