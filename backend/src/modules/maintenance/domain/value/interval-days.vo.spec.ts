import { UsageBasedIntervalNotSupported } from '../exceptions/usage-based-interval-not-supported.exception';
import { IntervalDays, MAX_INTERVAL_DAYS } from './interval-days.vo';
import { IntervalUnit } from './interval-unit';

describe('IntervalDays', () => {
  it('is a whole, positive number of days', () => {
    expect(IntervalDays.of(30).asNumber()).toBe(30);
  });

  it.each([0, -7, 1.5])('rejects %p days', (days) => {
    expect(() => IntervalDays.of(days)).toThrow();
  });

  it('is at most a hundred years of days', () => {
    expect(IntervalDays.of(MAX_INTERVAL_DAYS).asNumber()).toBe(36_500);
    expect(() => IntervalDays.of(MAX_INTERVAL_DAYS + 1)).toThrow();
  });

  it('is made from an interval given in days', () => {
    expect(IntervalDays.fromInterval(7, IntervalUnit.Days).asNumber()).toBe(7);
  });

  it('refuses an interval given in operating hours, which the plan cannot hold yet', () => {
    expect(() =>
      IntervalDays.fromInterval(500, IntervalUnit.OperatingHours),
    ).toThrow(UsageBasedIntervalNotSupported);
  });
});
