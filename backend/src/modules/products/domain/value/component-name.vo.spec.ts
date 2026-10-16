import { ComponentName } from './component-name.vo';

describe('ComponentName', () => {
  it('a component name created from a string preserves the provided value', () => {
    const sut = ComponentName.fromString('Bolt');
    expect(sut.asString()).toBe('Bolt');
  });

  it('an empty string is rejected', () => {
    expect(() => ComponentName.fromString('')).toThrow();
  });

  it('a whitespace-only string is rejected', () => {
    expect(() => ComponentName.fromString(' '.repeat(3))).toThrow();
  });

  it('two component names with the same value are equal', () => {
    const sut = ComponentName.fromString('Bolt');
    const other = ComponentName.fromString('Bolt');
    expect(sut.equals(other)).toBe(true);
  });

  it('two component names differing only by case are not equal', () => {
    const sut = ComponentName.fromString('Bolt');
    const other = ComponentName.fromString('BOLT');
    expect(sut.equals(other)).toBe(false);
  });
});
