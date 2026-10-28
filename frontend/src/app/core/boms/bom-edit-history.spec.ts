import { describe, expect, it } from 'vitest';

import { editHistoryLines, toAppBomEditHistory } from './bom-edit-history';

const HEADING_1 =
  'کاربر نیکروش در 1403/06/15 ساعت 10:00 به علت خطای ترازو تغییرات زیر را انجام داد';
const HEADING_2 =
  'کاربر مصطفی در 1403/06/15 ساعت 14:00 به علت اندازه گیری مجدد تغییرات زیر را انجام داد';

describe('toAppBomEditHistory', () => {
  it('maps every record with every field present', () => {
    expect(
      toAppBomEditHistory([
        {
          editedBy: 'نیکروش',
          editedAt: '2024-09-05T06:30:00.000Z',
          reason: 'خطای ترازو',
          heading: HEADING_1,
          changes: ['وزن جز مغزی مواد اولیه مسی از 3 به 2 تغییر کرد'],
        },
      ]),
    ).toEqual([
      {
        editedBy: 'نیکروش',
        editedAt: '2024-09-05T06:30:00.000Z',
        reason: 'خطای ترازو',
        heading: HEADING_1,
        changes: ['وزن جز مغزی مواد اولیه مسی از 3 به 2 تغییر کرد'],
      },
    ]);
  });

  it('reads a missing history as none', () => {
    expect(toAppBomEditHistory(undefined)).toEqual([]);
  });
});

describe('editHistoryLines', () => {
  it('lists each record’s heading, then each of its changes, record after record', () => {
    const lines = editHistoryLines([
      {
        editedBy: 'نیکروش',
        editedAt: '2024-09-05T06:30:00.000Z',
        reason: 'خطای ترازو',
        heading: HEADING_1,
        changes: [
          'وزن جز مغزی مواد اولیه مسی از 3 به 2 تغییر کرد',
          'شماره ردیابی از TRK-3005 به TRK-3006 تغییر کرد',
        ],
      },
      {
        editedBy: 'مصطفی',
        editedAt: '2024-09-05T10:30:00.000Z',
        reason: 'اندازه گیری مجدد',
        heading: HEADING_2,
        changes: ['وزن جز مغزی مواد اولیه مسی از 2 به 2.5 تغییر کرد'],
      },
    ]);

    expect(lines).toEqual([
      { kind: 'heading', text: HEADING_1 },
      { kind: 'change', text: 'وزن جز مغزی مواد اولیه مسی از 3 به 2 تغییر کرد' },
      { kind: 'change', text: 'شماره ردیابی از TRK-3005 به TRK-3006 تغییر کرد' },
      { kind: 'heading', text: HEADING_2 },
      { kind: 'change', text: 'وزن جز مغزی مواد اولیه مسی از 2 به 2.5 تغییر کرد' },
    ]);
  });

  it('has no lines for a daily BOM never edited', () => {
    expect(editHistoryLines([])).toEqual([]);
  });
});
