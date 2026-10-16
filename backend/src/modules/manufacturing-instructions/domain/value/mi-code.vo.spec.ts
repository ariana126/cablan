import { MiCode } from './mi-code.vo';

describe('MiCode', () => {
  it('a MI code created from a string preserves the provided value', () => {
    const sut = MiCode.fromString('1234');
    expect(sut.asString()).toBe('1234');
  });

  it('an empty string is rejected', () => {
    expect(() => MiCode.fromString('')).toThrow();
  });

  it('a whitespace-only string is rejected', () => {
    expect(() => MiCode.fromString(' '.repeat(3))).toThrow();
  });

  it('two MI codes with the same value are equal', () => {
    const sut = MiCode.fromString('1234');
    const other = MiCode.fromString('1234');
    expect(sut.equals(other)).toBe(true);
  });

  it('two MI codes differing only by case are not equal', () => {
    const sut = MiCode.fromString('abc');
    const other = MiCode.fromString('ABC');
    expect(sut.equals(other)).toBe(false);
  });
});
