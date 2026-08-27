import { OrderNumber } from './order-number.vo';

describe('OrderNumber', () => {
  it('an order number created from a string preserves the provided value', () => {
    const sut = OrderNumber.fromString('SO-1234');
    expect(sut.asString()).toBe('SO-1234');
  });

  it('an empty string is rejected', () => {
    expect(() => OrderNumber.fromString('')).toThrow();
  });

  it('a whitespace-only string is rejected', () => {
    expect(() => OrderNumber.fromString(' '.repeat(3))).toThrow();
  });

  it('two order numbers with the same value are equal', () => {
    const sut = OrderNumber.fromString('SO-1234');
    const other = OrderNumber.fromString('SO-1234');
    expect(sut.equals(other)).toBe(true);
  });
});
