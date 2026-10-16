import { MaterialName } from './material-name.vo';

describe('MaterialName', () => {
  it('a material name created from a string preserves the provided value', () => {
    const sut = MaterialName.fromString('Steel Rod');
    expect(sut.asString()).toBe('Steel Rod');
  });

  it('an empty string is rejected', () => {
    expect(() => MaterialName.fromString('')).toThrow();
  });

  it('a whitespace-only string is rejected', () => {
    expect(() => MaterialName.fromString(' '.repeat(3))).toThrow();
  });

  it('two material names with the same value are equal', () => {
    const sut = MaterialName.fromString('Steel Rod');
    const other = MaterialName.fromString('Steel Rod');
    expect(sut.equals(other)).toBe(true);
  });

  it('two material names differing only by case are not equal', () => {
    const sut = MaterialName.fromString('Steel Rod');
    const other = MaterialName.fromString('STEEL ROD');
    expect(sut.equals(other)).toBe(false);
  });
});
