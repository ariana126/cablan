/**
 * The reason every daily-BOM edit carries (issue #73, `bom-analyzing/daily-bom-edit-details.feature`),
 * and where the edit was made — the two fields `PATCH boms/:id` gained (pinned contract,
 * `docs/superpowers/plans/2026-10-28-daily-bom-edit-details.md`):
 *
 * - `editReason` — required, non-blank, for an edit that changes something; otherwise 400
 *   `edit-reason-required` and nothing changes. A save that changes nothing needs none.
 * - `editSource` — `'dailyBoms'` (the `/boms` list and the post-registration preview, the default)
 *   or `'dashboard'`. A dashboard edit by Management or the System Admin is a *review* edit: it goes
 *   into the management note at approval. Every other edit is a *correction*: it is appended to the
 *   daily BOM's edit details («جزئیات ویرایش»).
 *
 * Shared by every area that edits a daily BOM — bom-registration's form and API edits, the review
 * vocabulary, the audit-log fixtures — which is why it lives in `common/`.
 */

export type EditSource = 'dailyBoms' | 'dashboard';

/** The reason an edit gives when its step names none — any edit a scenario makes only to get the
 * system into a state, or whose reason is not what the scenario is about. */
export const ROUTINE_EDIT_REASON = 'اصلاح اطلاعات ثبت شده';

/** «بدون نوشتن دلیل» — the reason box left empty. */
export const NO_EDIT_REASON = '';

/** «با دلیلی که فقط از فاصله تشکیل شده» — a reason of spaces only. */
export const AN_EDIT_REASON_OF_SPACES_ONLY = '   ';

/** Why an edit is made, and where — what the backend needs to know to file it. */
export interface EditIntent {
  reason: string;
  source: EditSource;
}

/** An edit from the daily BOM list (or its preview): always a correction, whoever makes it. */
export const aCorrection = (
  reason: string = ROUTINE_EDIT_REASON,
): EditIntent => ({
  reason,
  source: 'dailyBoms',
});

/** An edit from the dashboard: a review edit when a reviewer makes it. */
export const anEditFromTheDashboard = (
  reason: string = ROUTINE_EDIT_REASON,
): EditIntent => ({ reason, source: 'dashboard' });

/** The two `PATCH boms/:id` body fields an edit intent becomes. */
export const editIntentFields = (
  intent: EditIntent,
): { editReason: string; editSource: EditSource } => ({
  editReason: intent.reason,
  editSource: intent.source,
});
