import { MAX_OPERATING_HOURS, OperatingHours } from './operating-hours.vo';

describe('OperatingHours', () => {
  it.each([0, 1, 250.5, 1234.25, 0.29, MAX_OPERATING_HOURS])(
    'holds %p hours',
    (hours) => {
      expect(OperatingHours.of(hours).asNumber()).toBe(hours);
    },
  );

  it('is at most a million hours', () => {
    expect(MAX_OPERATING_HOURS).toBe(1_000_000);
    expect(() => OperatingHours.of(MAX_OPERATING_HOURS + 0.01)).toThrow();
  });

  it.each([-1, -0.01, 1.005, 12.345, Number.NaN, Number.POSITIVE_INFINITY])(
    'refuses %p hours',
    (hours) => {
      expect(() => OperatingHours.of(hours)).toThrow();
    },
  );
});
