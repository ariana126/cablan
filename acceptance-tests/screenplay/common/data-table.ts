import {
  AnswersQuestions,
  Question,
  QuestionAdapter,
  Task,
} from '@serenity-js/core';
import { Ensure, equals } from '@serenity-js/assertions';
import { By, PageElements } from '@serenity-js/web';
import { LastResponse } from '@serenity-js/rest';

/**
 * "فهرست خالی نمایش داده شود" — shared, byte-identically, across every list-driving feature area
 * this suite automates a UI for (currently: `bom-analyzing/bom-dashboard.feature`,
 * `audit-logging/viewing-audit-log.feature`, and both `bom-reporting` report features — see
 * `step-definitions/common.steps.ts`). Page-agnostic on purpose, the same way
 * `screenplay/common/login.ts#EnsureRedirectedToLogIn` is: rather than a `screenplay/common/
 * report-context.ts`-style dispatch per feature area (which this single check has no real need
 * for), it just counts data rows on whatever page is currently open.
 *
 * ASSUMPTION: every such list in this frontend renders through Angular Material's `mat-table`,
 * whose data rows carry the `.mat-mdc-row` class — distinct from the header row's own
 * `.mat-mdc-header-row` — regardless of which entity the table lists. `CLAUDE.md` confirms the
 * frontend is Angular Material 21 throughout, which is what makes one class-based assumption safe
 * to share across features that otherwise know nothing about each other's markup.
 */
const CurrentListRows = () =>
  PageElements.located(By.css('.mat-mdc-row')).describedAs(
    'rows of the currently displayed list',
  );

/**
 * Reads "the currently displayed list"'s size off whichever door the acting actor last used —
 * door-aware, because `audit-logging/viewing-audit-log.feature`'s own "فیلتر بدون نتیجه منطبق"
 * rule reuses this EXACT step text ("فهرست خالی نمایش داده شود", once "انتظار می رود " — a valid
 * Persian `Then` keyword itself — is stripped) for an actor who drives the API only and has never
 * navigated a page at all. Counting `.mat-mdc-row` for such an actor would just count whatever an
 * untouched, blank browser tab happens to have — zero, vacuously "passing" regardless of what the
 * API actually returned. Preferring the actor's own last JSON response, when it looks like a
 * paginated list (`{ items: [...] }}`, the shape this backend's own paginated endpoints use), is
 * what keeps the check meaningful for that door; the `catch` below is what keeps it safe for every
 * UI-driving feature area that already relies on this step (bom-analyzing, both bom-reporting
 * report features) and has never made an API call of its own by the time this runs.
 */
const tryReadApiItemsCount = async (
  actor: AnswersQuestions,
): Promise<number | undefined> => {
  try {
    const body = await actor.answer(LastResponse.body<{ items?: unknown[] }>());
    return Array.isArray(body?.items) ? body.items.length : undefined;
  } catch {
    // No API response recorded for this actor yet — fall through to the DOM-based count.
    return undefined;
  }
};

const TheCurrentListSize = (): QuestionAdapter<number> =>
  Question.about('the size of the currently displayed list', async (actor) => {
    const apiItemsCount = await tryReadApiItemsCount(actor);
    if (apiItemsCount !== undefined) {
      return apiItemsCount;
    }
    return actor.answer(CurrentListRows().count());
  });

export const EnsureListIsEmpty = (): Task =>
  Task.where(
    '#actor ensures the currently displayed list is empty',
    Ensure.that(TheCurrentListSize(), equals(0)),
  );
