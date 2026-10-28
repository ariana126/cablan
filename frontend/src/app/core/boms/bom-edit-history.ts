import { BomEditRecord } from '../../api/model';

/**
 * One correction of a daily BOM («جزئیات ویرایش», issue #73): who, when, why, and what changed.
 * `heading` is rendered server-side — who, the Jalali date and time in Asia/Tehran, and why — so it
 * is shown as is and never re-formatted here; `changes` holds one Persian line per change.
 */
export interface AppBomEditRecord {
  readonly editedBy: string;
  readonly editedAt: string;
  readonly reason: string;
  readonly heading: string;
  readonly changes: readonly string[];
}

/** What an edit that changes something without a non-blank reason (`edit-reason-required`) is
 * told, on its «دلیل ویرایش» field — the `/boms` form and the dashboard alike. */
export const EDIT_REASON_REQUIRED = 'نوشتن دلیل ویرایش لازم است';

/** One displayed line of a daily BOM's edit details: a record's heading or one of its changes. */
export interface EditHistoryLine {
  readonly kind: 'heading' | 'change';
  readonly text: string;
}

/** The API's records, oldest first; a missing list is a daily BOM never corrected. */
export function toAppBomEditHistory(
  records: readonly BomEditRecord[] | undefined,
): AppBomEditRecord[] {
  return (records ?? []).map((record) => ({
    editedBy: record.editedBy,
    editedAt: record.editedAt,
    reason: record.reason,
    heading: record.heading,
    changes: [...record.changes],
  }));
}

/** The edit details as they read: each record's heading, then each of its changes, in order. */
export function editHistoryLines(history: readonly AppBomEditRecord[]): EditHistoryLine[] {
  return history.flatMap((record) => [
    { kind: 'heading' as const, text: record.heading },
    ...record.changes.map((change) => ({ kind: 'change' as const, text: change })),
  ]);
}
