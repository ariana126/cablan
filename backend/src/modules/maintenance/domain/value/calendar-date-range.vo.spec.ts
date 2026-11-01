import { DateRangeStartsAfterEnd } from '../exceptions/date-range-starts-after-end.exception';
import { CalendarDate } from './calendar-date.vo';
import { CalendarDateRange } from './calendar-date-range.vo';

const date = (value: string) => CalendarDate.fromString(value);

describe('CalendarDateRange', () => {
  const range = CalendarDateRange.between(
    date('2026-07-08'),
    date('2026-07-22'),
  );

  it.each([
    ['2026-07-07', false],
    ['2026-07-08', true],
    ['2026-07-15', true],
    ['2026-07-22', true],
    ['2026-07-23', false],
  ])('holds %s: %p (both bounds inclusive)', (day, held) => {
    expect(range.contains(date(day))).toBe(held);
  });

  it('may be a single day', () => {
    const day = CalendarDateRange.between(
      date('2026-07-08'),
      date('2026-07-08'),
    );

    expect(day.contains(date('2026-07-08'))).toBe(true);
  });

  it('cannot start after it ends', () => {
    expect(() =>
      CalendarDateRange.between(date('2026-07-10'), date('2026-07-01')),
    ).toThrow(DateRangeStartsAfterEnd);
  });
});
