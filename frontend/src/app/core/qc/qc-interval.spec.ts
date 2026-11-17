import { describe, expect, it } from 'vitest';

import { formatQcInterval, NO_PREVIOUS_EXECUTION } from './qc-interval';

describe('formatQcInterval', () => {
  it('joins the non-zero day, hour and minute parts with « و », in Persian digits', () => {
    expect(formatQcInterval(24 * 60 + 3 * 60 + 20)).toBe('۱ روز و ۳ ساعت و ۲۰ دقیقه');
  });

  it('leaves out the parts that are zero', () => {
    expect(formatQcInterval(120)).toBe('۲ ساعت');
    expect(formatQcInterval(2 * 24 * 60 + 5)).toBe('۲ روز و ۵ دقیقه');
  });

  it('reads a zero interval as «۰ دقیقه», never as blank', () => {
    expect(formatQcInterval(0)).toBe('۰ دقیقه');
  });

  it('says there was no earlier execution when the API sends none', () => {
    expect(formatQcInterval(null)).toBe(NO_PREVIOUS_EXECUTION);
    expect(NO_PREVIOUS_EXECUTION).toBe('بدون سابقه قبلی');
  });

  it('does not group a long run of days, which is a count, not an identifier', () => {
    expect(formatQcInterval(1234 * 24 * 60)).toBe('۱٬۲۳۴ روز');
  });
});
