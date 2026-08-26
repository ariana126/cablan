import { ProductName } from './product-name.vo';

describe('ProductName', () => {
  it('a product name created from a string preserves the provided value', () => {
    const sut = ProductName.fromString('Widget');
    expect(sut.asString()).toBe('Widget');
  });

  it('an empty string is rejected', () => {
    expect(() => ProductName.fromString('')).toThrow();
  });

  it('a whitespace-only string is rejected', () => {
    expect(() => ProductName.fromString(' '.repeat(3))).toThrow();
  });

  it('two product names with the same value are equal', () => {
    const sut = ProductName.fromString('Widget');
    const other = ProductName.fromString('Widget');
    expect(sut.equals(other)).toBe(true);
  });

  it('two product names differing only by case are not equal', () => {
    const sut = ProductName.fromString('Widget');
    const other = ProductName.fromString('WIDGET');
    expect(sut.equals(other)).toBe(false);
  });
});
