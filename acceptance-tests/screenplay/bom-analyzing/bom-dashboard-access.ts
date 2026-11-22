import { Task } from '@serenity-js/core';
import { PostRequest, Send } from '@serenity-js/rest';

/**
 * Issue #130: the QC inspector no longer reaches the daily-BOM dashboard. Who may is the backend's
 * rule (its 403), so the attempt goes over HTTP: `POST boms/dashboard` with no filter at all — a
 * body every role allowed in gets a 200 for, so only the role can refuse it.
 */
export const AttemptToViewTheDailyBomDashboard = {
  viaApi: (): Task =>
    Task.where(
      '#actor attempts to view the daily BOM dashboard (via API)',
      Send.a(PostRequest.to('boms/dashboard').with({})),
    ),
};
