import { describe, expect, it } from 'vitest';

import {
  AppMaintenanceExecution,
  AppMaintenanceHistoryEntry,
  AppMissedOccurrence,
} from '../../core/maintenance/equipment-gateway';
import { filterHistory, historyRange, NO_HISTORY_FILTER } from './history-filter';

const execution = (
  id: string,
  overrides: Partial<AppMaintenanceExecution> = {},
): AppMaintenanceExecution => ({
  kind: 'executed',
  id,
  planItemId: 'p1',
  activityName: 'تعویض روغن',
  dueDate: '2026-10-01',
  performedAt: new Date(2026, 9, 1, 10, 0).toISOString(),
  performedBy: 'مسلمی',
  status: 'on_time',
  notes: '',
  daysLate: null,
  activitySpecialty: 'mechanical',
  operatingHours: null,
  ...overrides,
});

const missed = (
  dueDate: string,
  overrides: Partial<AppMissedOccurrence> = {},
): AppMissedOccurrence => ({
  kind: 'missed',
  planItemId: 'p1',
  activityName: 'تعویض روغن',
  dueDate,
  status: 'missed',
  activitySpecialty: 'mechanical',
  ...overrides,
});

const keys = (rows: readonly AppMaintenanceHistoryEntry[]) =>
  rows.map((row) => (row.kind === 'executed' ? row.id : `missed ${row.dueDate}`));

describe('filterHistory', () => {
  const HISTORY: AppMaintenanceHistoryEntry[] = [
    execution('1'),
    execution('2', { activityName: 'بررسی تابلو برق', activitySpecialty: 'electrical' }),
    missed('2026-09-01'),
    missed('2026-09-08', { activityName: 'بررسی تابلو برق', activitySpecialty: 'electrical' }),
  ];

  it('keeps everything with no filter', () => {
    expect(keys(filterHistory(HISTORY, NO_HISTORY_FILTER))).toEqual([
      '1',
      '2',
      'missed 2026-09-01',
      'missed 2026-09-08',
    ]);
  });

  it('finds an activity by name, done or missed, Persian letter variants folded', () => {
    expect(keys(filterHistory(HISTORY, { ...NO_HISTORY_FILTER, query: 'تابلو' }))).toEqual([
      '2',
      'missed 2026-09-08',
    ]);
    expect(keys(filterHistory(HISTORY, { ...NO_HISTORY_FILTER, query: 'روغن' }))).toEqual([
      '1',
      'missed 2026-09-01',
    ]);
  });

  it('keeps one specialty, done or missed', () => {
    expect(keys(filterHistory(HISTORY, { ...NO_HISTORY_FILTER, specialty: 'electrical' }))).toEqual(
      ['2', 'missed 2026-09-08'],
    );
  });

  it('combines both filters', () => {
    expect(keys(filterHistory(HISTORY, { query: 'روغن', specialty: 'electrical' }))).toEqual([]);
  });
});

describe('historyRange', () => {
  it('asks for nothing narrower while neither day is chosen', () => {
    expect(historyRange(null, null)).toBeUndefined();
  });

  it('sends the days chosen as ISO calendar dates, both ends included', () => {
    expect(historyRange(new Date(2026, 8, 1), new Date(2026, 8, 30))).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    });
  });

  // The API takes both bounds or neither; an open end is the furthest day it accepts.
  it('closes an open end at the furthest day the API accepts', () => {
    expect(historyRange(new Date(2026, 8, 1), null)).toEqual({
      from: '2026-09-01',
      to: '2100-12-31',
    });
    expect(historyRange(null, new Date(2026, 8, 30))).toEqual({
      from: '2000-01-01',
      to: '2026-09-30',
    });
  });
});
