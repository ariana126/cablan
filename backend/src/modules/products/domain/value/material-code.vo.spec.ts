import { MaterialCode } from './material-code.vo';

describe('MaterialCode', () => {
  it('surrounding whitespace is trimmed from a material code', () => {
    const sut = MaterialCode.fromString('  RM-001 ');
    expect(sut.asString()).toBe('RM-001');
  });

  it('a whitespace-only material code is rejected', () => {
    expect(() => MaterialCode.fromString(' '.repeat(3))).toThrow();
  });

  it.each([undefined, null, '', ' '.repeat(3)])(
    'a missing or blank optional code (%p) is no code',
    (raw) => {
      expect(MaterialCode.fromOptionalString(raw)).toBeNull();
    },
  );

  it('a non-blank optional code is a trimmed material code', () => {
    const sut = MaterialCode.fromOptionalString(' RM-001 ');
    expect(sut?.asString()).toBe('RM-001');
  });
});
