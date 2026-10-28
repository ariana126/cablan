import { BomEditRecord } from '@boms/domain/value/bom-edit-record.vo';

// A `BomEditRecord` as `bom.edit_history` and `bom.pending_review_changes`
// store it: plain JSON, the instant as an ISO string. The heading is never
// stored — it is rendered from these four on every read, so the edit details
// and the management note always render it the same way.
export interface StoredBomEditRecord {
  readonly editedBy: string;
  readonly editedAt: string;
  readonly reason: string;
  readonly changes: string[];
}

export function toStoredEditRecord(record: BomEditRecord): StoredBomEditRecord {
  return {
    editedBy: record.editedBy(),
    editedAt: record.editedAt().toISOString(),
    reason: record.reason(),
    changes: [...record.changes()],
  };
}

/** Whether a stored JSON value has the shape of a stored edit record at all. */
export function looksLikeStoredEditRecord(value: unknown): boolean {
  return typeof value === 'object' && value !== null && 'editedBy' in value;
}

/**
 * Reads one stored edit record back. The columns only ever hold what
 * `toStoredEditRecord()` wrote; anything else means the row was written
 * outside the application, which is worth failing loudly on — the same
 * stance `toApprovalStatus()` takes on its column.
 */
export function toBomEditRecord(value: unknown): BomEditRecord {
  const stored = (value ?? {}) as Record<string, unknown>;
  const editedAt =
    typeof stored.editedAt === 'string' ? new Date(stored.editedAt) : null;
  if (
    typeof stored.editedBy !== 'string' ||
    editedAt === null ||
    Number.isNaN(editedAt.getTime()) ||
    typeof stored.reason !== 'string' ||
    !Array.isArray(stored.changes) ||
    !stored.changes.every((change) => typeof change === 'string')
  ) {
    throw new Error(
      `Unreadable edit record stored on a daily BOM: ${JSON.stringify(value)}`,
    );
  }
  return BomEditRecord.of(
    stored.editedBy,
    editedAt,
    stored.reason,
    stored.changes,
  );
}

/** `bom.edit_history` — the edit details («جزئیات ویرایش») — as stored. */
export function toEditHistoryColumn(
  records: readonly BomEditRecord[],
): StoredBomEditRecord[] {
  return records.map((record) => toStoredEditRecord(record));
}

/** Reads `bom.edit_history`, a JSON array of stored edit records. */
export function toEditHistory(column: unknown): BomEditRecord[] {
  if (!Array.isArray(column)) {
    throw new TypeError(
      `Edit history stored on a daily BOM must be an array: ${JSON.stringify(column)}`,
    );
  }
  return column.map((value) => toBomEditRecord(value));
}
