import { describe, expect, it } from 'vitest';

import { AppMaintenanceExecution } from '../../core/maintenance/equipment-gateway';
import { filterHistory, NO_HISTORY_FILTER } from './history-filter';

const execution = (
  id: string,
  overrides: Partial<AppMaintenanceExecution> = {},
): AppMaintenanceExecution => ({
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

const ids = (rows: readonly AppMaintenanceExecution[]) => rows.map((row) => row.id);

describe('filterHistory', () => {
  const HISTORY = [
    execution('1'),
    execution('2', { activityName: 'بررسی تابلو برق', activitySpecialty: 'electrical' }),
    execution('3', { performedAt: new Date(2026, 9, 5, 23, 30).toISOString() }),
  ];

  it('keeps everything with no filter', () => {
    expect(ids(filterHistory(HISTORY, NO_HISTORY_FILTER))).toEqual(['1', '2', '3']);
  });

  it('finds an activity by name, Persian letter variants folded', () => {
    expect(ids(filterHistory(HISTORY, { ...NO_HISTORY_FILTER, query: 'تابلو' }))).toEqual(['2']);
    expect(ids(filterHistory(HISTORY, { ...NO_HISTORY_FILTER, query: 'روغن' }))).toEqual([
      '1',
      '3',
    ]);
  });

  it('keeps one specialty', () => {
    expect(ids(filterHistory(HISTORY, { ...NO_HISTORY_FILTER, specialty: 'electrical' }))).toEqual([
      '2',
    ]);
  });

  // Days are the viewer's own, like the «زمان انجام» column shows them; «تا تاریخ» takes its whole day.
  it('keeps what was done within the days chosen, both ends included', () => {
    const range = { from: new Date(2026, 9, 2), to: new Date(2026, 9, 5) };

    expect(ids(filterHistory(HISTORY, { ...NO_HISTORY_FILTER, ...range }))).toEqual(['3']);
  });

  it('takes an open bound as no bound', () => {
    expect(
      ids(filterHistory(HISTORY, { ...NO_HISTORY_FILTER, from: new Date(2026, 9, 2) })),
    ).toEqual(['3']);
    expect(ids(filterHistory(HISTORY, { ...NO_HISTORY_FILTER, to: new Date(2026, 9, 1) }))).toEqual(
      ['1', '2'],
    );
  });

  it('combines every filter', () => {
    expect(
      ids(
        filterHistory(HISTORY, {
          query: 'روغن',
          specialty: 'mechanical',
          from: new Date(2026, 9, 1),
          to: new Date(2026, 9, 1),
        }),
      ),
    ).toEqual(['1']);
  });
});
