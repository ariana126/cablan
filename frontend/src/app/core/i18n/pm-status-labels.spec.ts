import { describe, expect, it } from 'vitest';

import { PmScheduleControllerOverview200ItemStatus as Status } from '../../api/model';
import { PM_STATUS_LABELS } from './pm-status-labels';

describe('PM_STATUS_LABELS', () => {
  it('names each status of a PM occurrence the way the floor says it', () => {
    expect(PM_STATUS_LABELS).toEqual({
      [Status.on_time]: 'بموقع',
      [Status.late]: 'با تاخیر',
      [Status.missed]: 'انجام نشده',
      [Status.overdue]: 'عقب افتاده',
      [Status.due]: 'سررسیده',
      [Status.upcoming]: 'آینده',
    });
  });
});
