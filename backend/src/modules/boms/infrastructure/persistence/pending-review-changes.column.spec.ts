import { BomEditRecord } from '@boms/domain/value/bom-edit-record.vo';
import { PendingReviewEdits } from '@boms/domain/value/pending-review-edits.vo';

import {
  toPendingReviewEdits,
  toPendingReviewEditsColumn,
} from './pending-review-changes.column';

// The row's last update (1403/06/14 10:00 in Tehran) — the best instant a
// review change stored before issue #73 has.
const ROW_UPDATED_AT = new Date('2024-09-04T06:30:00.000Z');

const REVIEW_EDIT = BomEditRecord.of(
  'مصطفی',
  new Date('2024-09-05T06:30:00.000Z'),
  'خطای ترازو',
  ['وزن جز مغزی مواد اولیه مسی از 3 به 2 تغییر کرد'],
);

const STORED_REVIEW_EDIT = {
  editedBy: 'مصطفی',
  editedAt: '2024-09-05T06:30:00.000Z',
  reason: 'خطای ترازو',
  changes: ['وزن جز مغزی مواد اولیه مسی از 3 به 2 تغییر کرد'],
};

// What a review stored before edits carried a reason (issue #73).
const LEGACY_FIELD_CHANGE = {
  kind: 'field',
  field: 'trackingNumber',
  previousValue: 'TRK-1',
  newValue: 'TRK-2',
} as const;
const LEGACY_MATERIAL_CHANGE = {
  kind: 'material',
  componentId: 'component-1',
  componentName: 'مغزی',
  materialId: 'material-1',
  materialName: 'مسی',
  previousWeight: 3,
  newWeight: null,
} as const;

// Those changes as the one review edit they are read as: no editor and no
// reason to name, so `-` for both, at the row's last update.
const LEGACY_AS_ONE_EDIT = BomEditRecord.of('-', ROW_UPDATED_AT, '-', [
  'شماره ردیابی از TRK-1 به TRK-2 تغییر کرد',
  'مواد اولیه مسی با وزن 3 از جز مغزی حذف شد',
]);

describe('pending review changes column', () => {
  it('stores the review edits as records of who, an ISO instant, why and their change lines', () => {
    const edits = PendingReviewEdits.none().withEdit(REVIEW_EDIT);

    expect(toPendingReviewEditsColumn(edits)).toEqual([STORED_REVIEW_EDIT]);
  });

  it('reads stored review edits back as they were', () => {
    expect(toPendingReviewEdits([STORED_REVIEW_EDIT], ROW_UPDATED_AT)).toEqual(
      PendingReviewEdits.none().withEdit(REVIEW_EDIT),
    );
  });

  it('reads an empty array as no review edits', () => {
    expect(toPendingReviewEdits([], ROW_UPDATED_AT).isEmpty()).toBe(true);
  });

  it('reads the changes a review stored before edits carried a reason as one review edit, by - for -, at the row’s last update', () => {
    const sut = toPendingReviewEdits(
      [LEGACY_FIELD_CHANGE, LEGACY_MATERIAL_CHANGE],
      ROW_UPDATED_AT,
    );

    expect(sut).toEqual(PendingReviewEdits.restore([LEGACY_AS_ONE_EDIT]));
  });

  it('keeps that older review edit ahead of the review edits stored since', () => {
    const sut = toPendingReviewEdits(
      [LEGACY_FIELD_CHANGE, LEGACY_MATERIAL_CHANGE, STORED_REVIEW_EDIT],
      ROW_UPDATED_AT,
    );

    expect(sut.edits()).toEqual([LEGACY_AS_ONE_EDIT, REVIEW_EDIT]);
  });

  it('rejects a stored value that is not an array', () => {
    expect(() => toPendingReviewEdits({}, ROW_UPDATED_AT)).toThrow();
  });

  it('rejects a stored change of an unknown kind', () => {
    expect(() =>
      toPendingReviewEdits([{ kind: 'other' }], ROW_UPDATED_AT),
    ).toThrow('other');
  });

  it('rejects an older stored field change naming a field an edit cannot change', () => {
    expect(() =>
      toPendingReviewEdits(
        [{ kind: 'field', field: 'brand', previousValue: 'a', newValue: 'b' }],
        ROW_UPDATED_AT,
      ),
    ).toThrow('brand');
  });

  it('rejects an older stored material change with a weight that is not a number', () => {
    expect(() =>
      toPendingReviewEdits(
        [{ ...LEGACY_MATERIAL_CHANGE, previousWeight: '3' }],
        ROW_UPDATED_AT,
      ),
    ).toThrow();
  });

  it('rejects a stored review edit with an instant that is not a date', () => {
    expect(() =>
      toPendingReviewEdits(
        [{ ...STORED_REVIEW_EDIT, editedAt: 'soon' }],
        ROW_UPDATED_AT,
      ),
    ).toThrow('edit record');
  });
});
