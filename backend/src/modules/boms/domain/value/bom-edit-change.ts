// One change an edit made to a daily BOM, as it is described to a person —
// one Persian line each, `changeLineOf()`. The same lines make up a
// correction's edit details («جزئیات ویرایش») and a review edit's block of
// the management note («توضیحات مدیریت»).

// The scalar fields an edit can change, in the order their lines are listed
// — before any material line. The one list: `EditedField` is derived from it.
export const EDITED_FIELDS = [
  'orderNumber',
  'trackingNumber',
  'description',
] as const;

export type EditedField = (typeof EDITED_FIELDS)[number];

export function isEditedField(field: string): field is EditedField {
  return (EDITED_FIELDS as readonly string[]).includes(field);
}

const FIELD_LABELS: Record<EditedField, string> = {
  orderNumber: 'شماره سفارش',
  trackingNumber: 'شماره ردیابی',
  description: 'توضیحات',
};

// A scalar field's move; `''` stands for "no value" (an absent description).
export interface FieldEditChange {
  readonly kind: 'field';
  readonly field: EditedField;
  readonly previousValue: string;
  readonly newValue: string;
}

// A material line's weight move, keyed by its (component, material) pair.
// `null` on one side means the line did not exist there — it was added
// (`previousWeight: null`) or removed (`newWeight: null`).
export interface MaterialEditChange {
  readonly kind: 'material';
  readonly componentId: string;
  readonly componentName: string;
  readonly materialId: string;
  readonly materialName: string;
  readonly previousWeight: number | null;
  readonly newWeight: number | null;
}

export type BomEditChange = FieldEditChange | MaterialEditChange;

/**
 * The change as one Persian line. Weights in their canonical number form
 * (`3`, not `3.0`); an empty value reads `-`.
 */
export function changeLineOf(change: BomEditChange): string {
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
