import { ValueObject } from '@framework/domain';

import { BomComponentLine } from './bom-component-line.vo';

// The scalar fields a review can note, in the order the note lists them —
// every scalar field `Bom.edit()` can change. The one list: `ReviewedField`
// is derived from it, and the stored changes are read back against it.
export const REVIEWED_FIELDS = [
  'orderNumber',
  'trackingNumber',
  'description',
] as const;

export type ReviewedField = (typeof REVIEWED_FIELDS)[number];

export function isReviewedField(field: string): field is ReviewedField {
  return (REVIEWED_FIELDS as readonly string[]).includes(field);
}

const FIELD_LABELS: Record<ReviewedField, string> = {
  orderNumber: 'شماره سفارش',
  trackingNumber: 'شماره ردیابی',
  description: 'توضیحات',
};

// A scalar field's move; `''` stands for "no value" (an absent description).
export interface ReviewedFieldChange {
  readonly kind: 'field';
  readonly field: ReviewedField;
  readonly previousValue: string;
  readonly newValue: string;
}

// A material line's weight move, keyed by its (component, material) pair.
// `null` on one side means the line did not exist there — it was added
// (`previousWeight: null`) or removed (`newWeight: null`).
export interface ReviewedMaterialChange {
  readonly kind: 'material';
  readonly componentId: string;
  readonly componentName: string;
  readonly materialId: string;
  readonly materialName: string;
  readonly previousWeight: number | null;
  readonly newWeight: number | null;
}

export type ReviewChange = ReviewedFieldChange | ReviewedMaterialChange;

/**
 * The changes made to a daily BOM during its current review by any reviewer
 * (a user who may approve or reject daily BOMs) — what approving it records
 * as the management note ("توضیحات مدیریت"). Plain data, so it can be stored
 * between the edit request and the approve request.
 *
 * Merging follows one rule per field or (component, material) pair: the
 * first previous value stands, the latest new value wins, and a value moved
 * back to where it started drops out. Scalar fields come first, in a fixed
 * order, then material lines in the BOM's composition order — lines no
 * longer in the composition (removals) last.
 */
export class PendingReviewChanges extends ValueObject {
  private constructor(private readonly _changes: readonly ReviewChange[]) {
    super();
  }

  static none(): PendingReviewChanges {
    return new PendingReviewChanges([]);
  }

  // For rehydrating stored changes (`BomMapper`).
  static restore(changes: readonly ReviewChange[]): PendingReviewChanges {
    return new PendingReviewChanges([...changes]);
  }

  /**
   * These changes with one more edit's own `changes` folded in; `composition`
   * is the BOM's composition after that edit, which orders the material lines.
   */
  public mergedWith(
    changes: readonly ReviewChange[],
    composition: readonly BomComponentLine[],
  ): PendingReviewChanges {
    const merged = new Map<string, ReviewChange>(
      this._changes.map((change) => [keyOf(change), change]),
    );
    for (const change of changes) {
      const key = keyOf(change);
      const earlier = merged.get(key);
      const combined =
        earlier === undefined ? change : combine(earlier, change);
      if (isNoChange(combined)) {
        merged.delete(key);
      } else {
        merged.set(key, combined);
      }
    }
    return new PendingReviewChanges(ordered([...merged.values()], composition));
  }

  public isEmpty(): boolean {
    return this._changes.length === 0;
  }

  /** One Persian line per change, joined by newlines; `null` when there are none. */
  public asManagementNote(): string | null {
    if (this.isEmpty()) {
      return null;
    }
    return this._changes.map((change) => lineOf(change)).join('\n');
  }

  public changes(): readonly ReviewChange[] {
    return this._changes;
  }
}

function keyOf(change: ReviewChange): string {
  return change.kind === 'field'
    ? `field:${change.field}`
    : materialKey(change.componentId, change.materialId);
}

function materialKey(componentId: string, materialId: string): string {
  return `material:${componentId}:${materialId}`;
}

function combine(earlier: ReviewChange, later: ReviewChange): ReviewChange {
  if (earlier.kind === 'field' && later.kind === 'field') {
    return { ...later, previousValue: earlier.previousValue };
  }
  if (earlier.kind === 'material' && later.kind === 'material') {
    return { ...later, previousWeight: earlier.previousWeight };
  }
  throw new Error('Only changes to the same field or material line combine');
}

function isNoChange(change: ReviewChange): boolean {
  return change.kind === 'field'
    ? change.previousValue === change.newValue
    : change.previousWeight === change.newWeight;
}

function ordered(
  changes: ReviewChange[],
  composition: readonly BomComponentLine[],
): ReviewChange[] {
  const compositionRank = new Map<string, number>();
  for (const component of composition)
    for (const material of component.materials()) {
      const key = materialKey(
        component.componentId().asString(),
        material.materialId().asString(),
      );
      if (!compositionRank.has(key)) {
        compositionRank.set(key, compositionRank.size);
      }
    }

  const rankOf = (change: ReviewChange): number =>
    change.kind === 'field'
      ? REVIEWED_FIELDS.indexOf(change.field) - REVIEWED_FIELDS.length
      : (compositionRank.get(keyOf(change)) ?? Number.MAX_SAFE_INTEGER);
  // `toSorted` is stable, so removed lines keep the order they were merged in.
  return changes.toSorted((a, b) => rankOf(a) - rankOf(b));
}

function lineOf(change: ReviewChange): string {
  if (change.kind === 'field') {
    return `${FIELD_LABELS[change.field]} از ${change.previousValue || '-'} به ${change.newValue || '-'} تغییر کرد`;
  }
  const { componentName, materialName, previousWeight, newWeight } = change;
  if (previousWeight === null) {
    return `مواد اولیه ${materialName} با وزن ${String(newWeight)} به جز ${componentName} اضافه شد`;
  }
  if (newWeight === null) {
    return `مواد اولیه ${materialName} با وزن ${String(previousWeight)} از جز ${componentName} حذف شد`;
  }
  return `وزن جز ${componentName} مواد اولیه ${materialName} از ${String(previousWeight)} به ${String(newWeight)} تغییر کرد`;
}
