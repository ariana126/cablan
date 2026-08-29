import { d, Question, QuestionAdapter, Task, Wait } from '@serenity-js/core';
import { Ensure, equals, isPresent } from '@serenity-js/assertions';
import { Click, isVisible, Text } from '@serenity-js/web';
import { StandardBomReportsPage } from '../ui/standard-bom-reports-page';
import { ViewStandardBomReportList } from './standard-bom-report-list';

/**
 * The standard-BOM half of the shared "جزئیات یک آنالیز [روزانه|استاندارد]" assertions
 * (`step-definitions/bom-reporting/common.steps.ts` dispatches on
 * `screenplay/common/report-context.ts`'s `currentReportKind()` to reach these).
 *
 * Mirrors `screenplay/bom-reporting/bom-report-details.ts`, but opens details by MI code
 * (the standard BOM's own business identifier) rather than by the daily BOM's order number —
 * the standard BOM is what the report is about, so its MI code is the only stable per-row
 * identity the report table carries.
 */

export interface ComponentDetailRow {
  componentName: string;
  materialName: string;
  weight: string;
}

/**
 * "سینا جزئیات آنالیز استاندارد با کد MI «...» را باز می کند" — locates the (unfiltered) report
 * page itself, then opens the read-only detail dialog for the given MI code. Like the daily BOM
 * equivalent, the detail button's own presence is waited on explicitly (by presence rather than
 * `isVisible()`) before clicking — see `bom-report-details.ts#OpenBomReportDetails` for the full
 * reasoning around horizontally-clipped buttons inside the table's own scroll container.
 */
export const OpenStandardBomReportDetails = (miCode: string): Task =>
  Task.where(
    d`#actor opens the standard BOM report details for "${miCode}"`,
    ViewStandardBomReportList.unfiltered(),
    Wait.until(StandardBomReportsPage.detailButton(miCode), isPresent()),
    Click.on(StandardBomReportsPage.detailButton(miCode)),
    Wait.until(StandardBomReportsPage.detailStandardLength(), isVisible()),
  );

const TheComponentDetailRows = (): QuestionAdapter<ComponentDetailRow[]> =>
  Question.about(
    'the detail dialog’s component/material rows',
    async (actor) => {
      const componentNames = await actor.answer(
        Text.ofAll(StandardBomReportsPage.detailComponentNameCells()),
      );
      const materialNames = await actor.answer(
        Text.ofAll(StandardBomReportsPage.detailMaterialNameCells()),
      );
      const weights = await actor.answer(
        Text.ofAll(StandardBomReportsPage.detailWeightCells()),
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
    Ensure.that(
      Text.of(StandardBomReportsPage.detailStandardLength()),
      equals(value),
    ),
  );

/** "توضیحات «...» نمایش داده شود" */
export const EnsureDescriptionShown = (value: string): Task =>
  Task.where(
    d`#actor ensures description "${value}" is shown`,
    Ensure.that(
      Text.of(StandardBomReportsPage.detailDescription()),
      equals(value),
    ),
  );

/** "جمع وزن مواد اولیه «...» نمایش داده شود" */
export const EnsureTotalWeightShown = (value: string): Task =>
  Task.where(
    d`#actor ensures total weight "${value}" is shown`,
    Ensure.that(
      Text.of(StandardBomReportsPage.detailTotalWeight()),
      equals(value),
    ),
  );
