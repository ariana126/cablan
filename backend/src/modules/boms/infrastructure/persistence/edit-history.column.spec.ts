import { BomEditRecord } from '@boms/domain/value/bom-edit-record.vo';

import { toEditHistory, toEditHistoryColumn } from './edit-history.column';

const RECORD = BomEditRecord.of(
  'نیکروش',
  new Date('2024-09-05T06:30:00.000Z'),
  'خطای ترازو',
  [
    'شماره ردیابی از TRK-1 به TRK-2 تغییر کرد',
    'وزن جز مغزی مواد اولیه مسی از 3 به 2 تغییر کرد',
  ],
);

const STORED = {
  editedBy: 'نیکروش',
  editedAt: '2024-09-05T06:30:00.000Z',
  reason: 'خطای ترازو',
  changes: [
    'شماره ردیابی از TRK-1 به TRK-2 تغییر کرد',
    'وزن جز مغزی مواد اولیه مسی از 3 به 2 تغییر کرد',
  ],
};

describe('edit history column', () => {
  it('stores each record as who, an ISO instant, why and its change lines', () => {
    expect(toEditHistoryColumn([RECORD])).toEqual([STORED]);
  });

  it('reads the stored records back as they were', () => {
    expect(toEditHistory([STORED, STORED])).toEqual([RECORD, RECORD]);
  });

  it('reads an empty array as no edit details', () => {
    expect(toEditHistory([])).toEqual([]);
  });

  it('rejects a stored value that is not an array', () => {
    expect(() => toEditHistory({})).toThrow();
  });

  it.each([
    ['an instant that is not a date', { ...STORED, editedAt: 'yesterday' }],
    ['a missing reason', { ...STORED, reason: undefined }],
    ['a change that is not text', { ...STORED, changes: [3] }],
    ['a missing editor', { ...STORED, editedBy: null }],
  ])('rejects a stored record with %s', (_problem, stored) => {
    expect(() => toEditHistory([stored])).toThrow('edit record');
  });
});
