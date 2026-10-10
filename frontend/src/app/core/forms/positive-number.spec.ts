import { describe, expect, it } from 'vitest';

import { isPositiveNumber } from './positive-number';

describe('isPositiveNumber', () => {
  it.each([0.1, 0.0001, 0.5, 1, 305, 1.5])('accepts %s', (value) => {
    expect(isPositiveNumber(value)).toBe(true);
  });

  it.each([0, -0, -0.1, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects %s', (value) => {
    expect(isPositiveNumber(value)).toBe(false);
  });
});
