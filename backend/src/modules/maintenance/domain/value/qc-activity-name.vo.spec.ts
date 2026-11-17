import { QcActivityName } from './qc-activity-name.vo';

describe('QcActivityName', () => {
  it('is trimmed, with Persian-keyboard digits as English ones', () => {
    expect(QcActivityName.fromString('  بازرسی ابعادی ۲  ').asString()).toBe(
      'بازرسی ابعادی 2',
    );
  });

  it.each(['', ' '.repeat(3)])('refuses a blank name (%p)', (name) => {
    expect(() => QcActivityName.fromString(name)).toThrow();
  });

  it('is one name however its digits were typed', () => {
    expect(
      QcActivityName.fromString('بازرسی ۲').equals(
        QcActivityName.fromString('بازرسی 2'),
      ),
    ).toBe(true);
  });
});
