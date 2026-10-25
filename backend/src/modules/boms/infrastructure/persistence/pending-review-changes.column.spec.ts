import { toReviewChanges } from './pending-review-changes.column';

describe('toReviewChanges', () => {
  it('reads stored field and material changes', () => {
    const stored = [
      {
        kind: 'field',
        field: 'trackingNumber',
        previousValue: 'TRK-1',
        newValue: 'TRK-2',
      },
      {
        kind: 'material',
        componentId: 'component-1',
        componentName: 'مغزی',
        materialId: 'material-1',
        materialName: 'مسی',
        previousWeight: 3,
        newWeight: null,
      },
    ];

    expect(toReviewChanges(stored)).toEqual(stored);
  });

  it('reads an empty array as no changes', () => {
    expect(toReviewChanges([])).toEqual([]);
  });

  it('rejects a stored value that is not an array', () => {
    expect(() => toReviewChanges({})).toThrow();
  });

  it('rejects a stored change of an unknown kind', () => {
    expect(() => toReviewChanges([{ kind: 'other' }])).toThrow('other');
  });

  it('rejects a stored field change naming a field a review does not note', () => {
    expect(() =>
      toReviewChanges([
        { kind: 'field', field: 'brand', previousValue: 'a', newValue: 'b' },
      ]),
    ).toThrow('brand');
  });

  it('rejects a stored material change with a weight that is not a number', () => {
    expect(() =>
      toReviewChanges([
        {
          kind: 'material',
          componentId: 'component-1',
          componentName: 'مغزی',
          materialId: 'material-1',
          materialName: 'مسی',
          previousWeight: '3',
          newWeight: 2,
        },
      ]),
    ).toThrow();
  });
});
