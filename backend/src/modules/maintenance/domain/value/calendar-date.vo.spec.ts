import { CalendarDate } from './calendar-date.vo';

describe('CalendarDate', () => {
  it('reads back the ISO date it was made from', () => {
    expect(CalendarDate.fromString('2026-09-23').asString()).toBe('2026-09-23');
  });

  it.each(['', '2026-9-23', '2026-02-30', '23/09/2026', '2026-09-23T00:00'])(
    'rejects %p, which is not a calendar date',
    (value) => {
      expect(() => CalendarDate.fromString(value)).toThrow();
    },
  );

  it('adds days across a month and a year boundary', () => {
    expect(CalendarDate.fromString('2026-12-25').plusDays(10).asString()).toBe(
      '2027-01-04',
    );
  });

  it('counts the days from one date to another', () => {
    const from = CalendarDate.fromString('2026-09-23');
    expect(from.daysUntil(CalendarDate.fromString('2026-10-02'))).toBe(9);
    expect(CalendarDate.fromString('2026-10-02').daysUntil(from)).toBe(-9);
  });

  it('orders dates', () => {
    const earlier = CalendarDate.fromString('2026-09-23');
    const later = CalendarDate.fromString('2026-09-24');

    expect(earlier.isBefore(later)).toBe(true);
    expect(later.isBefore(earlier)).toBe(false);
    expect(earlier.isAfter(later)).toBe(false);
    expect(later.isAfter(earlier)).toBe(true);
    expect(earlier.equals(CalendarDate.fromString('2026-09-23'))).toBe(true);
  });

  describe('the Tehran calendar date of an instant', () => {
    it('is the next day for a late-evening UTC instant, Tehran being ahead', () => {
      // 21:00 UTC is 00:30 the next day in Tehran (UTC+03:30).
      expect(
        CalendarDate.inTehranOf(
          new Date('2026-10-01T21:00:00.000Z'),
        ).asString(),
      ).toBe('2026-10-02');
    });

    it('is the same day for an instant before Tehran midnight', () => {
      expect(
        CalendarDate.inTehranOf(
          new Date('2026-10-01T20:29:59.000Z'),
        ).asString(),
      ).toBe('2026-10-01');
    });
  });
});
