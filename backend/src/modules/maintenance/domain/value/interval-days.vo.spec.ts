import { UsageBasedIntervalNotSupported } from '../exceptions/usage-based-interval-not-supported.exception';
import { IntervalDays } from './interval-days.vo';
import { IntervalUnit } from './interval-unit';

describe('IntervalDays', () => {
  it('is a whole, positive number of days', () => {
    expect(IntervalDays.of(30).asNumber()).toBe(30);
  });

  it.each([0, -7, 1.5])('rejects %p days', (days) => {
    expect(() => IntervalDays.of(days)).toThrow();
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
