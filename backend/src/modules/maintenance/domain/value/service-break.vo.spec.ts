import { CalendarDate } from './calendar-date.vo';
import { ServiceBreak } from './service-break.vo';

const date = (value: string) => CalendarDate.fromString(value);
// 09:00 Tehran on that day.
const morningOf = (isoDate: string) => new Date(`${isoDate}T05:30:00.000Z`);
// 01:00 Tehran on that day — still the previous day in UTC.
const smallHoursOf = (isoDate: string) => {
  const day = date(isoDate).plusDays(-1).asString();
  return new Date(`${day}T21:30:00.000Z`);
};

describe('ServiceBreak', () => {
  it('is open from the moment the equipment is retired', () => {
    const retirement = ServiceBreak.startingAt(morningOf('2026-10-02'));

    expect(retirement.isOpen()).toBe(true);
    expect(retirement.retiredAt()).toEqual(morningOf('2026-10-02'));
    expect(retirement.reactivatedAt()).toBeNull();
  });

  it('keeps the equipment out of service from the day after its retirement day on, while open', () => {
    const gap = ServiceBreak.startingAt(morningOf('2026-10-02')).gap();

    expect(gap?.isOpen()).toBe(true);
    expect(gap?.contains(date('2026-10-02'))).toBe(false);
    expect(gap?.contains(date('2026-10-03'))).toBe(true);
    expect(gap?.contains(date('2099-01-01'))).toBe(true);
  });

  it('is retired on the Tehran date of its retirement', () => {
    expect(
      ServiceBreak.startingAt(smallHoursOf('2026-10-02'))
        .retiredOn()
        .asString(),
    ).toBe('2026-10-02');
  });

  it('closes when the equipment is reactivated, its gap running from the day after the retirement day to the day before the reactivation day', () => {
    const closed = ServiceBreak.startingAt(morningOf('2026-10-02')).endingAt(
      morningOf('2026-10-12'),
    );

    expect(closed.isOpen()).toBe(false);
    expect(closed.reactivatedAt()).toEqual(morningOf('2026-10-12'));
    const gap = closed.gap();
    expect(gap?.contains(date('2026-10-02'))).toBe(false);
    expect(gap?.contains(date('2026-10-03'))).toBe(true);
    expect(gap?.contains(date('2026-10-11'))).toBe(true);
    expect(gap?.contains(date('2026-10-12'))).toBe(false);
  });

  it('leaves no gap when reactivated the day after the retirement day', () => {
    expect(
      ServiceBreak.startingAt(morningOf('2026-10-02'))
        .endingAt(morningOf('2026-10-03'))
        .gap(),
    ).toBeNull();
  });

  it('leaves no gap when retired and reactivated on one Tehran day', () => {
    const sameDay = ServiceBreak.startingAt(morningOf('2026-10-02')).endingAt(
      new Date('2026-10-02T15:00:00.000Z'),
    );

    expect(sameDay.gap()).toBeNull();
  });

  it('refuses to close twice', () => {
    const closed = ServiceBreak.startingAt(morningOf('2026-10-02')).endingAt(
      morningOf('2026-10-12'),
    );

    expect(() => closed.endingAt(morningOf('2026-10-20'))).toThrow();
  });

  it('refuses a reactivation before its retirement', () => {
    expect(() =>
      ServiceBreak.restore(morningOf('2026-10-12'), morningOf('2026-10-02')),
    ).toThrow();
  });

  it('is restored as stored', () => {
    const restored = ServiceBreak.restore(
      morningOf('2026-10-02'),
      morningOf('2026-10-12'),
    );

    expect(restored).toEqual(
      ServiceBreak.startingAt(morningOf('2026-10-02')).endingAt(
        morningOf('2026-10-12'),
      ),
    );
  });
});
