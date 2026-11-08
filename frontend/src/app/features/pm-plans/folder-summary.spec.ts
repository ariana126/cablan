import { describe, expect, it } from 'vitest';

import { AppEquipmentDetail, AppPmPlanItem } from '../../core/maintenance/equipment-gateway';
import { folderSummary } from './folder-summary';

const item = (id: string, nextDueDate: string): AppPmPlanItem => ({
  id,
  activityId: `a${id}`,
  activityName: `فعالیت ${id}`,
  activitySpecialty: 'mechanical',
  intervalDays: 30,
  firstDueDate: '2026-01-01',
  nextDueDate,
});

const equipment = (planItems: AppPmPlanItem[], retired = false): AppEquipmentDetail => ({
  id: 'e1',
  name: 'اکسترودر 1',
  retired,
  planItems,
  inactivePlanItems: [],
});

const TODAY = '2026-11-08';

describe('folderSummary', () => {
  it('counts the active plan rows', () => {
    const summary = folderSummary(
      equipment([item('1', '2026-11-20'), item('2', '2026-12-01')]),
      TODAY,
    );

    expect(summary.activeItemCount).toBe(2);
  });

  // The next due date is the earliest occurrence not yet done; one before today is past due.
  it('counts as overdue the rows whose next due date has passed, not one due today', () => {
    const summary = folderSummary(
      equipment([item('1', '2026-11-01'), item('2', TODAY), item('3', '2026-11-07')]),
      TODAY,
    );

    expect(summary.overdueCount).toBe(2);
  });

  it('names the nearest next due date', () => {
    const summary = folderSummary(
      equipment([item('1', '2026-12-01'), item('2', '2026-11-20')]),
      TODAY,
    );

    expect(summary.nearestDueDate).toBe('2026-11-20');
  });

  it('has no nearest due date and nothing overdue without a plan', () => {
    const summary = folderSummary(equipment([]), TODAY);

    expect(summary).toEqual({ activeItemCount: 0, overdueCount: 0, nearestDueDate: null });
  });

  // A retired equipment's PM stops while it is retired: nothing is due on it.
  it('has nothing overdue and nothing due on retired equipment', () => {
    const summary = folderSummary(equipment([item('1', '2026-11-01')], true), TODAY);

    expect(summary).toEqual({ activeItemCount: 1, overdueCount: 0, nearestDueDate: null });
  });
});
