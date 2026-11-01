import { describe, expect, it } from 'vitest';

import { AppPmDashboardOccurrence } from '../../core/maintenance/pm-dashboard-gateway';
import {
  followUpCsv,
  followUpDelayLabel,
  followUpRows,
  focusLabel,
  NO_FOLLOW_UP_FILTER,
  sortFollowUpRows,
} from './pm-follow-up';

const occurrence = (overrides: Partial<AppPmDashboardOccurrence>): AppPmDashboardOccurrence => ({
  equipmentId: 'e1',
  equipmentName: 'اکسترودر 1',
  equipmentRetired: false,
  planItemId: 'p1',
  activityId: 'a1',
  activityName: 'تعویض روغن',
  dueDate: '2026-10-01',
  status: 'upcoming',
  daysOverdue: 0,
  daysLate: null,
  missedOn: null,
  performedAt: null,
  performedByName: null,
  notes: null,
  doneToday: false,
  recordable: false,
  ...overrides,
});

const dueToday = occurrence({ planItemId: 'due', status: 'due', recordable: true });
const overdue = occurrence({
  planItemId: 'overdue',
  equipmentId: 'e2',
  equipmentName: 'اکسترودر 2',
  status: 'overdue',
  daysOverdue: 4,
  recordable: true,
  dueDate: '2026-09-27',
});
const late = occurrence({
  planItemId: 'late',
  activityName: 'بررسی تابلو برق',
  status: 'late',
  daysLate: 2,
  dueDate: '2026-09-20',
  doneToday: true,
});
const missed = occurrence({
  planItemId: 'missed',
  status: 'missed',
  dueDate: '2026-09-10',
  missedOn: '2026-09-17',
});
const ALL = [dueToday, overdue, late, missed];

const ids = (rows: readonly AppPmDashboardOccurrence[]) => rows.map((row) => row.planItemId);

describe('the follow-up table', () => {
  describe('filtering', () => {
    it('shows every occurrence with no filter', () => {
      expect(ids(followUpRows(ALL, NO_FOLLOW_UP_FILTER))).toEqual([
        'due',
        'overdue',
        'late',
        'missed',
      ]);
    });

    it('keeps what a card counts', () => {
      const focused = (kind: 'due-today' | 'overdue' | 'done-today' | 'missed') =>
        ids(followUpRows(ALL, { ...NO_FOLLOW_UP_FILTER, focus: { kind } }));

      expect(focused('due-today')).toEqual(['due']);
      expect(focused('overdue')).toEqual(['overdue']);
      expect(focused('done-today')).toEqual(['late']);
      expect(focused('missed')).toEqual(['missed']);
    });

    // A due or overdue occurrence the card does not count — a retired equipment's — is not
    // recordable, so the card's rows match its number.
    it('leaves a due occurrence that cannot be recorded out of «سررسید امروز»', () => {
      const retired = occurrence({ planItemId: 'retired', status: 'due', recordable: false });

      expect(
        ids(followUpRows([retired], { ...NO_FOLLOW_UP_FILTER, focus: { kind: 'due-today' } })),
      ).toEqual([]);
    });

    it('keeps the occurrences due within a trend point', () => {
      const rows = followUpRows(ALL, {
        ...NO_FOLLOW_UP_FILTER,
        focus: { kind: 'period', from: '2026-09-15', to: '2026-09-21' },
      });

      expect(ids(rows)).toEqual(['late']);
    });

    it('keeps one equipment’s overdue work', () => {
      const rows = followUpRows(ALL, {
        ...NO_FOLLOW_UP_FILTER,
        focus: { kind: 'equipment-overdue', equipmentId: 'e2', equipmentName: 'اکسترودر 2' },
      });

      expect(ids(rows)).toEqual(['overdue']);
    });

    it('narrows by status', () => {
      expect(ids(followUpRows(ALL, { ...NO_FOLLOW_UP_FILTER, status: 'late' }))).toEqual(['late']);
    });

    it('searches equipment and activity names, folding letter and digit forms', () => {
      expect(ids(followUpRows(ALL, { ...NO_FOLLOW_UP_FILTER, search: 'اکسترودر ۲' }))).toEqual([
        'overdue',
      ]);
      expect(ids(followUpRows(ALL, { ...NO_FOLLOW_UP_FILTER, search: 'تابلو' }))).toEqual(['late']);
    });
  });

  it('names each focus as the chip shows it', () => {
    expect(focusLabel({ kind: 'overdue' })).toBe('عقب افتاده');
    expect(
      focusLabel({ kind: 'equipment-overdue', equipmentId: 'e2', equipmentName: 'اکسترودر 2' }),
    ).toBe('کارهای عقب افتاده اکسترودر 2');
    expect(focusLabel({ kind: 'period', from: '2026-10-02', to: '2026-10-02' })).toBe(
      'موعدهای ۱۴۰۵/۰۷/۱۰',
    );
  });

  it('words the delay of a late or an overdue occurrence, and a hyphen otherwise', () => {
    expect(followUpDelayLabel(late)).toBe('۲ روز');
    expect(followUpDelayLabel(overdue)).toBe('۴ روز');
    expect(followUpDelayLabel(dueToday)).toBe('-');
  });

  describe('sorting', () => {
    it('keeps the API’s order when unsorted', () => {
      expect(ids(sortFollowUpRows(ALL, { column: '', direction: '' }))).toEqual(ids(ALL));
    });

    it('sorts by due date either way', () => {
      expect(ids(sortFollowUpRows(ALL, { column: 'dueDate', direction: 'asc' }))).toEqual([
        'missed',
        'late',
        'overdue',
        'due',
      ]);
      expect(ids(sortFollowUpRows(ALL, { column: 'dueDate', direction: 'desc' }))).toEqual([
        'due',
        'overdue',
        'late',
        'missed',
      ]);
    });

    it('sorts by delay, no delay first ascending', () => {
      expect(ids(sortFollowUpRows(ALL, { column: 'delay', direction: 'desc' }))).toEqual([
        'overdue',
        'late',
        'due',
        'missed',
      ]);
    });

    it('sorts by status most urgent first', () => {
      expect(ids(sortFollowUpRows(ALL, { column: 'status', direction: 'asc' }))).toEqual([
        'overdue',
        'due',
        'missed',
        'late',
      ]);
    });
  });

  describe('the export', () => {
    it('is a UTF-8 CSV with a byte-order mark, one line per row, Jalali dates', () => {
      const csv = followUpCsv([late, overdue]);

      expect(csv.startsWith('\uFEFF')).toBe(true);
      expect(csv.slice(1).split('\r\n')).toEqual([
        'تجهیز,فعالیت,تاریخ سررسید,وضعیت,مقدار تاخیر (روز),زمان انجام,انجام دهنده,توضیحات',
        'اکسترودر 1,بررسی تابلو برق,1405/06/29,با تاخیر,2,,,',
        'اکسترودر 2,تعویض روغن,1405/07/05,عقب افتاده,4,,,',
      ]);
    });

    // A cell Excel would read as a formula (`=`, `+`, `-`, `@`, or a leading tab or carriage return)
    // is written as text, so a note or a name can never run in whoever opens the file.
    it.each(['=HYPERLINK("http://x")', '+1+1', '-2+3', '@SUM(A1)', '\t=1', '\r=1'])(
      'writes a value starting like a formula (%j) as text',
      (dangerous) => {
        const csv = followUpCsv([
          occurrence({
            equipmentName: dangerous,
            activityName: dangerous,
            performedByName: dangerous,
            notes: dangerous,
          }),
        ]);
        const [equipment, activity, , , , , performer, notes] = csv
          .slice(1)
          .split('\r\n')[1]
          .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);

        for (const cell of [equipment, activity, performer, notes]) {
          expect(cell.replace(/^"/, '').startsWith(`'`)).toBe(true);
        }
      },
    );

    it('leaves ordinary values, dates and day counts as they are', () => {
      const csv = followUpCsv([late]);

      expect(csv.slice(1).split('\r\n')[1]).toBe(
        'اکسترودر 1,بررسی تابلو برق,1405/06/29,با تاخیر,2,,,',
      );
    });

    it('quotes a value holding a comma, a quote or a line break', () => {
      const csv = followUpCsv([occurrence({ notes: 'روغن، "فیلتر",\nتمیزکاری' })]);

      expect(csv).toContain('"روغن، ""فیلتر"",\nتمیزکاری"');
    });
  });
});
