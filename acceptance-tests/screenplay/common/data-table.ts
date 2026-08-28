import { Task } from '@serenity-js/core';
import { Ensure, equals } from '@serenity-js/assertions';
import { By, PageElements } from '@serenity-js/web';

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

export const EnsureListIsEmpty = (): Task =>
  Task.where(
    '#actor ensures the currently displayed list is empty',
    Ensure.that(CurrentListRows().count(), equals(0)),
  );
