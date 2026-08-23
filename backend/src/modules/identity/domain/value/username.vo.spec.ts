import { Username } from './username.vo';

describe('Username', () => {
  it('a username created from a string preserves the provided value', () => {
    const sut = Username.fromString('sina.q');
    expect(sut.asString()).toBe('sina.q');
  });

  it('an empty string is rejected', () => {
    expect(() => Username.fromString('')).toThrow();
  });

  it('a whitespace-only string is rejected', () => {
    expect(() => Username.fromString(' '.repeat(3))).toThrow();
  });

  it('two usernames with the same value are equal', () => {
    const sut = Username.fromString('sina.q');
    const other = Username.fromString('sina.q');
    expect(sut.equals(other)).toBe(true);
  });

  it('two usernames differing only by case are not equal', () => {
    const sut = Username.fromString('sina.q');
    const other = Username.fromString('SINA.Q');
    expect(sut.equals(other)).toBe(false);
  });
});
