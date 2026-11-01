import { describe, expect, it } from 'vitest';

import {
  averageDaysLateLabel,
  coveragePercentLabel,
  NOT_ENOUGH_DATA,
  performancePercentLabel,
  trendRangeLabel,
} from './pm-dashboard-figures';

describe('PM dashboard figures', () => {
  it('writes a percentage in Persian digits with the Persian percent sign', () => {
    expect(performancePercentLabel(70)).toBe('۷۰٪');
    expect(performancePercentLabel(0)).toBe('۰٪');
  });

  it('says there is not enough data for a performance percentage with nothing to judge', () => {
    expect(performancePercentLabel(null)).toBe(NOT_ENOUGH_DATA);
    expect(NOT_ENOUGH_DATA).toBe('داده کافی وجود ندارد');
  });

  it('shows an em dash for coverage when there is no active equipment', () => {
    expect(coveragePercentLabel(null)).toBe('—');
    expect(coveragePercentLabel(75)).toBe('۷۵٪');
  });

  it('writes the average days late without a trailing zero, else with one decimal', () => {
    expect(averageDaysLateLabel(3)).toBe('۳ روز');
    expect(averageDaysLateLabel(3.5)).toBe('۳٫۵ روز');
  });

  it('shows a hyphen when nothing was late', () => {
    expect(averageDaysLateLabel(null)).toBe('-');
  });

  it('names a one-day trend point by its Jalali day, a week by both ends', () => {
    expect(trendRangeLabel({ from: '2026-10-02', to: '2026-10-02' })).toBe('۱۴۰۵/۰۷/۱۰');
    expect(trendRangeLabel({ from: '2026-09-26', to: '2026-10-02' })).toBe(
      '۱۴۰۵/۰۷/۰۴ تا ۱۴۰۵/۰۷/۱۰',
    );
  });
});
