import { d, Question, QuestionAdapter, Task, Wait } from '@serenity-js/core';
import { Ensure, equals, isPresent } from '@serenity-js/assertions';
import { Click, isVisible, Text } from '@serenity-js/web';
import { BomReportsPage } from '../ui/bom-reports-page';
import { ViewBomReportList } from './bom-report-list';

/**
 * The daily-BOM half of the shared "جزئیات یک آنالیز [روزانه|استاندارد]" assertions
 * (`step-definitions/bom-reporting/common.steps.ts` dispatches on
 * `screenplay/common/report-context.ts`'s `currentReportKind()` to reach these).
 */

export interface ComponentDetailRow {
  componentName: string;
  materialName: string;
  weight: string;
}

/**
 * "سینا جزئیات آنالیز روزانه با شماره سفارش «...» را باز می کند" — locates the (unfiltered) report
 * page itself, then opens the read-only detail dialog for the given order number. Unlike this
 * feature's other `When` steps, "مشاهده جزئیات یک آنالیز روزانه" is the scenario's OWN only `When`
 * — there is no preceding "سینا لیست ... مشاهده می کند" step to have located the page already, so
 * this task can't assume one did; `ViewBomReportList.unfiltered()` is reused here for exactly that
 * (navigates, waits for the heading).
 *
 * The detail button's own presence is waited on explicitly, by presence rather than
 * `isVisible()`, before clicking — not merely to cover the report's own async load (a `Click`
 * already retries via Playwright's `scrollIntoViewIfNeeded`), but because the report table sits
 * inside a horizontally-scrollable `.table-scroll` container (`bom-reports-page.scss`) with eight
 * columns of Persian text; an element clipped by a scrolled ancestor still has real layout
 * (`count()`/`isPresent()`-true) but fails `isVisible()`'s occlusion check, exactly the same
 * scrolled-out-of-a-clipped-container trap `screenplay/bom-registration/bom-form.ts#aFormErrorIsVisible`'s
 * own comment documents for `mat-dialog-content`'s scrollport — `Click`'s own `scrollIntoViewIfNeeded`
 * is what actually brings a horizontally-clipped button into view, so this only needs to confirm
 * the row has rendered at all, not that it's already on-screen.
 */
export const OpenBomReportDetails = (orderNumber: string): Task =>
  Task.where(
    d`#actor opens the daily BOM report details for "${orderNumber}"`,
    ViewBomReportList.unfiltered(),
    Wait.until(BomReportsPage.detailButton(orderNumber), isPresent()),
    Click.on(BomReportsPage.detailButton(orderNumber)),
    Wait.until(BomReportsPage.detailStandardLength(), isVisible()),
  );

const TheComponentDetailRows = (): QuestionAdapter<ComponentDetailRow[]> =>
  Question.about(
    'the detail dialog’s component/material rows',
    async (actor) => {
      const componentNames = await actor.answer(
        Text.ofAll(BomReportsPage.detailComponentNameCells()),
      );
      const materialNames = await actor.answer(
        Text.ofAll(BomReportsPage.detailMaterialNameCells()),
      );
      const weights = await actor.answer(
        Text.ofAll(BomReportsPage.detailWeightCells()),
      );
      return componentNames.map((componentName, index) => ({
        componentName,
        materialName: materialNames[index],
        weight: weights[index],
      }));
    },
  );

/** "جزئیات اجزا و مواد اولیه به صورت زیر نمایش داده شود" */
export const EnsureComponentDetailRowsAreExactly = (
  expected: ComponentDetailRow[],
): Task =>
  Task.where(
    '#actor ensures the component/material detail rows are exactly as expected',
    Ensure.that(TheComponentDetailRows(), equals(expected)),
  );

/** "متراژ استاندارد «...» نمایش داده شود" */
export const EnsureStandardLengthShown = (value: string): Task =>
  Task.where(
    d`#actor ensures standard length "${value}" is shown`,
    Ensure.that(Text.of(BomReportsPage.detailStandardLength()), equals(value)),
  );

/** "توضیحات «...» نمایش داده شود" */
export const EnsureDescriptionShown = (value: string): Task =>
  Task.where(
    d`#actor ensures description "${value}" is shown`,
    Ensure.that(Text.of(BomReportsPage.detailDescription()), equals(value)),
  );

/** "جمع وزن مواد اولیه «...» نمایش داده شود" */
export const EnsureTotalWeightShown = (value: string): Task =>
  Task.where(
    d`#actor ensures total weight "${value}" is shown`,
    Ensure.that(Text.of(BomReportsPage.detailTotalWeight()), equals(value)),
  );
