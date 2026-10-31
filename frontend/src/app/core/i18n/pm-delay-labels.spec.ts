import { describe, expect, it } from 'vitest';

import { NO_DELAY, pmDelayLabel } from './pm-delay-labels';

describe('pmDelayLabel', () => {
  it('reads a late occurrence’s delay as whole days, in Persian digits', () => {
    expect(pmDelayLabel(2)).toBe('۲ روز');
  });

  it('groups a long delay the way every other quantity is grouped', () => {
    expect(pmDelayLabel(1200)).toBe('۱٬۲۰۰ روز');
  });

  it('reads no delay as a plain hyphen, never blank', () => {
    expect(pmDelayLabel(null)).toBe('-');
    expect(NO_DELAY).toBe('-');
  });
});
