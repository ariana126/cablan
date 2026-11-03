import { describe, expect, it } from 'vitest';

import { SPECIALTY_LABELS, specialtyLabel, UNASSIGNED_SPECIALTY_LABEL } from './specialty-labels';

describe('specialty labels', () => {
  it('names each specialty the way the technical unit says it', () => {
    expect(SPECIALTY_LABELS).toEqual({ electrical: 'برق', mechanical: 'مکانیک' });
  });

  it('names an activity without a specialty «تخصص تعیین نشده»', () => {
    expect(UNASSIGNED_SPECIALTY_LABEL).toBe('تخصص تعیین نشده');
    expect(specialtyLabel(null)).toBe('تخصص تعیین نشده');
  });

  it('labels a specialty', () => {
    expect(specialtyLabel('electrical')).toBe('برق');
    expect(specialtyLabel('mechanical')).toBe('مکانیک');
  });
});
