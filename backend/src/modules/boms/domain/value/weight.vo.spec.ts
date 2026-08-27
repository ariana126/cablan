import { Weight } from './weight.vo';

describe('Weight', () => {
  it('a weight created from a positive number of grams preserves the provided value', () => {
    const sut = Weight.ofGrams(150);
    expect(sut.asGrams()).toBe(150);
  });

  it('zero is rejected', () => {
    expect(() => Weight.ofGrams(0)).toThrow();
  });

  it('a negative number is rejected', () => {
    expect(() => Weight.ofGrams(-5)).toThrow();
  });

  it('NaN is rejected', () => {
    expect(() => Weight.ofGrams(Number.NaN)).toThrow();
  });

  it('two weights with the same value are equal', () => {
    const sut = Weight.ofGrams(150);
    const other = Weight.ofGrams(150);
    expect(sut.equals(other)).toBe(true);
  });
});
