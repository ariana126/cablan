import { Task } from '@serenity-js/core';
import { PostRequest, Send } from '@serenity-js/rest';

/**
 * Issue #130: the QC inspector no longer reaches the standard-BOM list («آنالیز های استاندارد»,
 * the report page) nor its export. The daily-BOM form still reads the standard BOMs it clones a
 * composition from (`GET standard-boms`), so the list the visitor *browses* is the report:
 * `POST standard-boms/report`, and its download `POST standard-boms/report/export`. Who may is
 * the backend's rule (its 403), so both attempts go over HTTP with a valid body — the first page
 * unfiltered, the export in its per-material layout — so only the role can refuse them.
 */
export const AttemptToViewTheStandardBomList = {
  viaApi: (): Task =>
    Task.where(
      '#actor attempts to view the standard BOM list (via API)',
      Send.a(
        PostRequest.to('standard-boms/report').with({ page: 1, pageSize: 20 }),
      ),
    ),
};

export const AttemptToExportTheStandardBomList = {
  viaApi: (): Task =>
    Task.where(
      '#actor attempts to export the standard BOM list (via API)',
      Send.a(
        PostRequest.to('standard-boms/report/export').with({
          format: 'perMaterial',
        }),
      ),
    ),
};
