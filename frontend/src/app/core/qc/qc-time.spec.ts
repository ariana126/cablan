import { describe, expect, it } from 'vitest';

import { NO_TIME, qcLastExecution, qcTime } from './qc-time';

describe('qcTime', () => {
  it('shows an instant on Tehran’s clock, in Jalali with Persian digits', () => {
    expect(qcTime('2026-09-23T06:30:00.000Z')).toBe('۱۴۰۵/۰۷/۰۱ ۱۰:۰۰');
  });

  it('shows a missing or unreadable instant as a dash', () => {
    expect(qcTime(null)).toBe(NO_TIME);
    expect(qcTime('')).toBe(NO_TIME);
  });
});

describe('qcLastExecution', () => {
  it('shows the last execution on Tehran’s clock', () => {
    expect(qcLastExecution('2026-09-23T06:30:00.000Z')).toBe('۱۴۰۵/۰۷/۰۱ ۱۰:۰۰');
  });

  it('says «بدون سابقه» for an activity never recorded', () => {
    expect(qcLastExecution(null)).toBe('بدون سابقه');
  });
});
