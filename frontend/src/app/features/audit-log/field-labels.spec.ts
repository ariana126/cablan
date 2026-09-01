import { describe, expect, it } from 'vitest';

import { fieldLabel } from './field-labels';

describe('fieldLabel', () => {
  it('translates a known technical field key to its Persian label', () => {
    expect(fieldLabel('standardLength')).toBe('متراژ استاندارد');
  });

  it('falls back to the raw key for a field it has no translation for', () => {
    expect(fieldLabel('someFutureField')).toBe('someFutureField');
  });
});
