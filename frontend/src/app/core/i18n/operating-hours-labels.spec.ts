import { describe, expect, it } from 'vitest';

import { NO_OPERATING_HOURS, operatingHoursLabel } from './operating-hours-labels';

describe('operatingHoursLabel', () => {
  it('reads a recorded value in Persian digits, in «ساعت»', () => {
    expect(operatingHoursLabel(1250.5)).toBe('۱٬۲۵۰٫۵ ساعت');
    expect(operatingHoursLabel(12)).toBe('۱۲ ساعت');
  });

  it('reads zero as a reading', () => {
    expect(operatingHoursLabel(0)).toBe('۰ ساعت');
  });

  it('reads an absent value as «ثبت نشده», never as zero', () => {
    expect(NO_OPERATING_HOURS).toBe('ثبت نشده');
    expect(operatingHoursLabel(null)).toBe('ثبت نشده');
  });
});
