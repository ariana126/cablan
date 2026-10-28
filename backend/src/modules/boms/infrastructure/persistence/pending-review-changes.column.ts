import {
  BomEditChange,
  changeLineOf,
  isEditedField,
} from '@boms/domain/value/bom-edit-change';
import { BomEditRecord } from '@boms/domain/value/bom-edit-record.vo';
import { PendingReviewEdits } from '@boms/domain/value/pending-review-edits.vo';

import {
  looksLikeStoredEditRecord,
  StoredBomEditRecord,
  toBomEditRecord,
  toStoredEditRecord,
} from './edit-history.column';

// Who and why, for the review changes stored before edits named either.
const UNKNOWN = '-';

/**
 * `bom.pending_review_changes` as stored: the review edits, one stored edit
 * record each (see `edit-history.column.ts`).
 */
export function toPendingReviewEditsColumn(
  edits: PendingReviewEdits,
): StoredBomEditRecord[] {
  return edits.edits().map((edit) => toStoredEditRecord(edit));
}

/**
 * Reads `bom.pending_review_changes`, a JSON array, back as the domain's
 * `PendingReviewEdits`.
 *
 * **Both shapes are read**, element by element, rather than the column being
 * converted by a migration: a stored edit record (`{ editedBy, editedAt,
 * reason, changes }`), or — on a BOM still pending since before issue #73 —
 * the merged per-field changes reviews stored then
 * (`{ kind: 'field' | 'material', … }`). Those carry no editor, time or
 * reason, so they are read as **one review edit**, ahead of any stored since:
 * by `-`, for `-`, at `rowUpdatedAt` (the row's last update — the best
 * instant they have), with their lines as its changes. The domain never sees
 * the older shape; the next save of the row stores that edit in the new one.
 *
 * Anything else means the row was written outside the application, which is
 * worth failing loudly on — the same stance `toApprovalStatus()` takes on its
 * column.
 */
export function toPendingReviewEdits(
  column: unknown,
  rowUpdatedAt: Date,
): PendingReviewEdits {
  if (!Array.isArray(column)) {
    throw new TypeError(
      `Pending review changes stored on a daily BOM must be an array: ${JSON.stringify(column)}`,
    );
  }
  const legacyChanges: BomEditChange[] = [];
  const edits: BomEditRecord[] = [];
  for (const value of column) {
    if (looksLikeStoredEditRecord(value)) {
      edits.push(toBomEditRecord(value));
    } else {
      legacyChanges.push(toLegacyChange(value));
    }
  }
  if (legacyChanges.length > 0) {
    edits.unshift(
      BomEditRecord.of(
        UNKNOWN,
        rowUpdatedAt,
        UNKNOWN,
        legacyChanges.map((change) => changeLineOf(change)),
      ),
    );
  }
  return PendingReviewEdits.restore(edits);
}

function toLegacyChange(value: unknown): BomEditChange {
  const change = (value ?? {}) as Record<string, unknown>;
  if (change.kind === 'field') {
    if (
      typeof change.field !== 'string' ||
      !isEditedField(change.field) ||
      typeof change.previousValue !== 'string' ||
      typeof change.newValue !== 'string'
    ) {
      throw unreadable(value);
    }
    return {
      kind: 'field',
      field: change.field,
      previousValue: change.previousValue,
      newValue: change.newValue,
    };
  }
  if (change.kind === 'material') {
    if (
      typeof change.componentId !== 'string' ||
      typeof change.componentName !== 'string' ||
      typeof change.materialId !== 'string' ||
      typeof change.materialName !== 'string' ||
      !isWeightOrNull(change.previousWeight) ||
      !isWeightOrNull(change.newWeight)
    ) {
      throw unreadable(value);
    }
    return {
      kind: 'material',
      componentId: change.componentId,
      componentName: change.componentName,
      materialId: change.materialId,
      materialName: change.materialName,
      previousWeight: change.previousWeight,
      newWeight: change.newWeight,
    };
  }
  throw unreadable(value);
}

function isWeightOrNull(value: unknown): value is number | null {
  return value === null || typeof value === 'number';
}

function unreadable(value: unknown): Error {
  return new Error(
    `Unreadable pending review change stored on a daily BOM: ${JSON.stringify(value)}`,
  );
}
