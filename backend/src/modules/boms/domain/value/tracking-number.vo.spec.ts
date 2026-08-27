import { TrackingNumber } from './tracking-number.vo';

describe('TrackingNumber', () => {
  it('a tracking number created from a string preserves the provided value', () => {
    const sut = TrackingNumber.fromString('TN-5678');
    expect(sut.asString()).toBe('TN-5678');
  });

  it('an empty string is rejected', () => {
    expect(() => TrackingNumber.fromString('')).toThrow();
  });

  it('a whitespace-only string is rejected', () => {
    expect(() => TrackingNumber.fromString(' '.repeat(3))).toThrow();
  });

  it('two tracking numbers with the same value are equal', () => {
    const sut = TrackingNumber.fromString('TN-5678');
    const other = TrackingNumber.fromString('TN-5678');
    expect(sut.equals(other)).toBe(true);
  });
});
