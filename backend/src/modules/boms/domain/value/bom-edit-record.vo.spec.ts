import { BomEditRecord } from './bom-edit-record.vo';

// 1403/06/15 10:00 in Tehran (UTC+03:30).
const AT_TEN_IN_TEHRAN = new Date('2024-09-05T06:30:00.000Z');

function record(
  overrides: Partial<{
    editedBy: string;
    editedAt: Date;
    reason: string;
    changes: string[];
  }> = {},
): BomEditRecord {
  return BomEditRecord.of(
    overrides.editedBy ?? 'نیکروش',
    overrides.editedAt ?? AT_TEN_IN_TEHRAN,
    overrides.reason ?? 'خطای ترازو',
    overrides.changes ?? ['شماره ردیابی از TN-1 به TN-2 تغییر کرد'],
  );
}

describe('BomEditRecord', () => {
  it('heads the record with who edited, the Jalali date and time in Tehran, and why', () => {
    const sut = record();

    expect(sut.heading()).toBe(
      'کاربر نیکروش در 1403/06/15 ساعت 10:00 به علت خطای ترازو تغییرات زیر را انجام داد',
    );
  });

  it('reads as its heading followed by one line per change', () => {
    const sut = record({
      changes: [
        'شماره سفارش از SO-1 به SO-2 تغییر کرد',
        'وزن جز مغزی مواد اولیه مس از 3 به 2 تغییر کرد',
      ],
    });

    expect(sut.lines()).toEqual([
      'کاربر نیکروش در 1403/06/15 ساعت 10:00 به علت خطای ترازو تغییرات زیر را انجام داد',
      'شماره سفارش از SO-1 به SO-2 تغییر کرد',
      'وزن جز مغزی مواد اولیه مس از 3 به 2 تغییر کرد',
    ]);
  });

  it.each([[''], [' '.repeat(3)]])(
    'cannot exist without a reason (%p)',
    (reason) => {
      expect(() => record({ reason })).toThrow('reason');
    },
  );

  it('cannot exist without a change', () => {
    expect(() => record({ changes: [] })).toThrow('change');
  });
});
