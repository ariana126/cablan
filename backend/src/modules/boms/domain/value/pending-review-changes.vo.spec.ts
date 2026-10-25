import { Identity } from '@framework/domain';

import { BomComponentLine } from './bom-component-line.vo';
import { BomMaterialLine } from './bom-material-line.vo';
import {
  PendingReviewChanges,
  ReviewedFieldChange,
  ReviewedMaterialChange,
} from './pending-review-changes.vo';
import { Weight } from './weight.vo';

const CORE = Identity.fromString('component-core');
const SHEATH = Identity.fromString('component-sheath');
const COPPER = Identity.fromString('material-copper');
const ALUMINIUM = Identity.fromString('material-aluminium');

// The composition the BOM holds after the edit: مغزی (مسی), then روکش (آلومینیوم).
function composition(): BomComponentLine[] {
  return [
    BomComponentLine.of(CORE, 'مغزی', [
      BomMaterialLine.of(COPPER, 'مسی', Weight.ofGrams(2)),
    ]),
    BomComponentLine.of(SHEATH, 'روکش', [
      BomMaterialLine.of(ALUMINIUM, 'آلومینیوم', Weight.ofGrams(4)),
    ]),
  ];
}

function fieldChange(
  field: ReviewedFieldChange['field'],
  previousValue: string,
  newValue: string,
): ReviewedFieldChange {
  return { kind: 'field', field, previousValue, newValue };
}

function copperChange(
  previousWeight: number | null,
  newWeight: number | null,
): ReviewedMaterialChange {
  return {
    kind: 'material',
    componentId: CORE.asString(),
    componentName: 'مغزی',
    materialId: COPPER.asString(),
    materialName: 'مسی',
    previousWeight,
    newWeight,
  };
}

function aluminiumChange(
  previousWeight: number | null,
  newWeight: number | null,
): ReviewedMaterialChange {
  return {
    kind: 'material',
    componentId: SHEATH.asString(),
    componentName: 'روکش',
    materialId: ALUMINIUM.asString(),
    materialName: 'آلومینیوم',
    previousWeight,
    newWeight,
  };
}

describe('PendingReviewChanges', () => {
  it('no review changes make no management note', () => {
    const sut = PendingReviewChanges.none();

    expect(sut.asManagementNote()).toBeNull();
  });

  it('a weight change reads as one line naming its component and material, with weights as entered', () => {
    const sut = PendingReviewChanges.none();

    const note = sut
      .mergedWith([copperChange(3, 2.5)], composition())
      .asManagementNote();

    expect(note).toBe('وزن جز مغزی مواد اولیه مسی از 3 به 2.5 تغییر کرد');
  });

  it('order number, tracking number and description changes read with their Persian labels', () => {
    const sut = PendingReviewChanges.none();

    const note = sut
      .mergedWith(
        [
          fieldChange('orderNumber', 'ORD-1', 'ORD-2'),
          fieldChange('trackingNumber', 'TRK-1', 'TRK-2'),
          fieldChange('description', 'قدیم', 'جدید'),
        ],
        composition(),
      )
      .asManagementNote();

    expect(note).toBe(
      [
        'شماره سفارش از ORD-1 به ORD-2 تغییر کرد',
        'شماره ردیابی از TRK-1 به TRK-2 تغییر کرد',
        'توضیحات از قدیم به جدید تغییر کرد',
      ].join('\n'),
    );
  });

  it('a description added where there was none reads its missing side as -', () => {
    const sut = PendingReviewChanges.none();

    const note = sut
      .mergedWith([fieldChange('description', '', 'جدید')], composition())
      .asManagementNote();

    expect(note).toBe('توضیحات از - به جدید تغییر کرد');
  });

  it('a material added to a component reads as an addition with its weight', () => {
    const sut = PendingReviewChanges.none();

    const note = sut
      .mergedWith([copperChange(null, 2)], composition())
      .asManagementNote();

    expect(note).toBe('مواد اولیه مسی با وزن 2 به جز مغزی اضافه شد');
  });

  it('a material removed from a component reads as a removal with its former weight', () => {
    const sut = PendingReviewChanges.none();

    const note = sut.mergedWith([copperChange(3, null)], []).asManagementNote();

    expect(note).toBe('مواد اولیه مسی با وزن 3 از جز مغزی حذف شد');
  });

  it('a field changed twice keeps its first previous value and its latest new value', () => {
    const sut = PendingReviewChanges.none().mergedWith(
      [fieldChange('orderNumber', 'ORD-1', 'ORD-2')],
      composition(),
    );

    const note = sut
      .mergedWith([fieldChange('orderNumber', 'ORD-2', 'ORD-3')], composition())
      .asManagementNote();

    expect(note).toBe('شماره سفارش از ORD-1 به ORD-3 تغییر کرد');
  });

  it('a weight changed twice keeps its first previous weight and its latest new weight', () => {
    const sut = PendingReviewChanges.none().mergedWith(
      [copperChange(3, 2)],
      composition(),
    );

    const note = sut
      .mergedWith([copperChange(2, 1)], composition())
      .asManagementNote();

    expect(note).toBe('وزن جز مغزی مواد اولیه مسی از 3 به 1 تغییر کرد');
  });

  it('a field changed back to where it started drops out', () => {
    const sut = PendingReviewChanges.none().mergedWith(
      [fieldChange('orderNumber', 'ORD-1', 'ORD-2')],
      composition(),
    );

    const merged = sut.mergedWith(
      [fieldChange('orderNumber', 'ORD-2', 'ORD-1')],
      composition(),
    );

    expect(merged.isEmpty()).toBe(true);
  });

  it('a weight changed back to where it started drops out', () => {
    const sut = PendingReviewChanges.none().mergedWith(
      [copperChange(3, 2)],
      composition(),
    );

    const merged = sut.mergedWith([copperChange(2, 3)], composition());

    expect(merged.asManagementNote()).toBeNull();
  });

  it('weight lines follow the composition order whatever order the edits came in', () => {
    const sut = PendingReviewChanges.none().mergedWith(
      [aluminiumChange(6, 4)],
      composition(),
    );

    const note = sut
      .mergedWith([copperChange(3, 2)], composition())
      .asManagementNote();

    expect(note).toBe(
      [
        'وزن جز مغزی مواد اولیه مسی از 3 به 2 تغییر کرد',
        'وزن جز روکش مواد اولیه آلومینیوم از 6 به 4 تغییر کرد',
      ].join('\n'),
    );
  });

  it('field lines come before weight lines', () => {
    const sut = PendingReviewChanges.none().mergedWith(
      [copperChange(3, 2)],
      composition(),
    );

    const note = sut
      .mergedWith([fieldChange('description', 'قدیم', 'جدید')], composition())
      .asManagementNote();

    expect(note).toBe(
      [
        'توضیحات از قدیم به جدید تغییر کرد',
        'وزن جز مغزی مواد اولیه مسی از 3 به 2 تغییر کرد',
      ].join('\n'),
    );
  });

  it('restored changes read back as they were stored', () => {
    const stored = [
      fieldChange('trackingNumber', 'TRK-1', 'TRK-2'),
      copperChange(3, 2),
    ];

    const sut = PendingReviewChanges.restore(stored);

    expect(sut.changes()).toEqual(stored);
  });
});
