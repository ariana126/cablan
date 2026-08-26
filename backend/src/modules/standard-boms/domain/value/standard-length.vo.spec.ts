import { StandardLength } from './standard-length.vo';

describe('StandardLength', () => {
  it('a standard length created from a positive number preserves the provided value', () => {
    const sut = StandardLength.of(305);
    expect(sut.asNumber()).toBe(305);
  });

  it('zero is rejected', () => {
    expect(() => StandardLength.of(0)).toThrow();
  });

  it('a negative number is rejected', () => {
    expect(() => StandardLength.of(-10)).toThrow();
  });

  it('NaN is rejected', () => {
    expect(() => StandardLength.of(Number.NaN)).toThrow();
  });

  it('two standard lengths with the same value are equal', () => {
    const sut = StandardLength.of(305);
    const other = StandardLength.of(305);
    expect(sut.equals(other)).toBe(true);
  });
});
