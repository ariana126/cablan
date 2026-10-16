import { Brand } from './brand.vo';

describe('Brand', () => {
  it('a brand created from a string preserves the provided value', () => {
    const sut = Brand.fromString('Legrand');
    expect(sut.asString()).toBe('Legrand');
  });

  it('an empty string is rejected', () => {
    expect(() => Brand.fromString('')).toThrow();
  });

  it('a whitespace-only string is rejected', () => {
    expect(() => Brand.fromString(' '.repeat(3))).toThrow();
  });

  it('two brands with the same value are equal', () => {
    const sut = Brand.fromString('Legrand');
    const other = Brand.fromString('Legrand');
    expect(sut.equals(other)).toBe(true);
  });
});
