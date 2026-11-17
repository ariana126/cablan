import { wholeMinutesBetween } from './qc-interval';

describe('wholeMinutesBetween', () => {
  it('is 1 day, 3 hours and 20 minutes as 1640 minutes', () => {
    expect(
      wholeMinutesBetween(
        new Date('2026-09-23T04:30:00.000Z'),
        new Date('2026-09-24T07:50:00.000Z'),
      ),
    ).toBe(1640);
  });

  it('drops the seconds of an unfinished minute', () => {
    expect(
      wholeMinutesBetween(
        new Date('2026-09-23T04:30:00.000Z'),
        new Date('2026-09-23T04:32:59.999Z'),
      ),
    ).toBe(2);
  });

  it('is 0 for two records within the same minute', () => {
    expect(
      wholeMinutesBetween(
        new Date('2026-09-23T04:30:00.000Z'),
        new Date('2026-09-23T04:30:40.000Z'),
      ),
    ).toBe(0);
  });
});
