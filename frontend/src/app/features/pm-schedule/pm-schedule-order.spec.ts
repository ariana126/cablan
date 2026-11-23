import { describe, expect, it } from 'vitest';

import { AppPmOccurrence } from '../../core/maintenance/pm-schedule-gateway';
import { sortedByDueDate } from './pm-schedule-order';

const occurrence = (overrides: Partial<AppPmOccurrence>): AppPmOccurrence => ({
  equipmentId: 'e1',
  equipmentName: 'اکسترودر',
  equipmentRetired: false,
  planItemId: 'p1',
  activityId: 'a1',
  activityName: 'تعویض روغن',
  activitySpecialty: null,
  dueDate: '2026-10-23',
  calendarDate: '2026-10-23',
  status: 'upcoming',
  performedAt: null,
  performedById: null,
  performedBy: null,
  daysLate: null,
  notes: null,
  ...overrides,
});

const line = (candidate: AppPmOccurrence) =>
  `${candidate.dueDate} ${candidate.equipmentName} ${candidate.activityName}`;

describe('sortedByDueDate', () => {
  it('puts the earliest due date first, across every equipment', () => {
    const sorted = sortedByDueDate([
      occurrence({ equipmentName: 'الف', dueDate: '2026-11-05' }),
      occurrence({ equipmentName: 'الف', dueDate: '2026-10-01' }),
      occurrence({ equipmentName: 'ب', dueDate: '2026-09-15' }),
      occurrence({ equipmentName: 'ب', dueDate: '2026-12-31' }),
    ]);

    expect(sorted.map((candidate) => candidate.dueDate)).toEqual([
      '2026-09-15',
      '2026-10-01',
      '2026-11-05',
      '2026-12-31',
    ]);
  });

  it('breaks a tie on the due date by equipment, then by activity', () => {
    const sorted = sortedByDueDate([
      occurrence({ equipmentName: 'کشش', activityName: 'روغن' }),
      occurrence({ equipmentName: 'اکسترودر', activityName: 'گریس' }),
      occurrence({ equipmentName: 'اکسترودر', activityName: 'بازدید' }),
    ]);

    expect(sorted.map(line)).toEqual([
      '2026-10-23 اکسترودر بازدید',
      '2026-10-23 اکسترودر گریس',
      '2026-10-23 کشش روغن',
    ]);
  });

  it('keeps the given order of occurrences alike in all three', () => {
    const first = occurrence({ planItemId: 'first' });
    const second = occurrence({ planItemId: 'second' });

    expect(sortedByDueDate([first, second])).toEqual([first, second]);
    expect(sortedByDueDate([second, first])).toEqual([second, first]);
  });

  it('leaves the list it was given as it was', () => {
    const given = [
      occurrence({ dueDate: '2026-11-05' }),
      occurrence({ dueDate: '2026-10-01' }),
    ] as const;

    sortedByDueDate(given);

    expect(given.map((candidate) => candidate.dueDate)).toEqual(['2026-11-05', '2026-10-01']);
  });
});
