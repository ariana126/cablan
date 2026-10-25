import {
  isReviewedField,
  ReviewChange,
} from '@boms/domain/value/pending-review-changes.vo';

/**
 * Reads `bom.pending_review_changes`, a JSON column, back as the domain's
 * `ReviewChange[]`. The column only ever holds what `BomMapper` wrote from
 * `PendingReviewChanges.changes()`; anything else means the row was written
 * outside the application, which is worth failing loudly on — the same
 * stance `toApprovalStatus()` takes on its column.
 */
export function toReviewChanges(column: unknown): ReviewChange[] {
  if (!Array.isArray(column)) {
    throw new TypeError(
      `Pending review changes stored on a daily BOM must be an array: ${JSON.stringify(column)}`,
    );
  }
  return column.map((change) => toReviewChange(change));
}

function toReviewChange(value: unknown): ReviewChange {
  const change = (value ?? {}) as Record<string, unknown>;
  if (change.kind === 'field') {
    if (
      typeof change.field !== 'string' ||
      !isReviewedField(change.field) ||
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
